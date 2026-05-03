-- Migration: Add Publishers, Membership Tiers, and Fine Management

begin;

-- ============================================================================
-- 1. Publishers Normalization
-- ============================================================================
create table if not exists public.publishers (
  id serial primary key,
  name text not null unique,
  address text,
  website text,
  created_at timestamptz default now()
);

alter table public.books 
  add column if not exists publisher_id int references public.publishers(id) on delete set null;

-- Enable RLS for publishers
alter table public.publishers enable row level security;

create policy "publishers_public_read"
  on public.publishers for select
  to anon, authenticated
  using (true);

create policy "publishers_admin_all"
  on public.publishers for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ============================================================================
-- 2. Membership Tiers
-- ============================================================================
create table if not exists public.membership_tiers (
  id serial primary key,
  name text not null unique,
  max_borrows int not null default 5,
  daily_fine_rate decimal(10, 2) not null default 10.00, -- e.g., 10 units per day
  description text,
  created_at timestamptz default now()
);

-- Seed default tiers
insert into public.membership_tiers (name, max_borrows, daily_fine_rate, description)
values 
  ('Student', 5, 5.00, 'Standard student membership'),
  ('Faculty', 10, 2.00, 'Faculty membership with higher limits and lower fines'),
  ('Public', 3, 15.00, 'General public membership')
on conflict (name) do nothing;

-- Link users to tiers
alter table public.users
  add column if not exists tier_id int references public.membership_tiers(id) default 1; -- Default to Student

-- Enable RLS for membership_tiers
alter table public.membership_tiers enable row level security;

create policy "tiers_public_read"
  on public.membership_tiers for select
  to authenticated
  using (true);

-- ============================================================================
-- 3. Fine Management in Borrow History
-- ============================================================================
alter table public.borrow_history
  add column if not exists fine_amount decimal(10, 2) default 0.00,
  add column if not exists fine_status text check (fine_status in ('none', 'unpaid', 'paid')) default 'none';

-- ============================================================================
-- 4. Update request_borrow to use dynamic limits
-- ============================================================================
create or replace function public.request_borrow(p_book_id int, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count int;
  v_available_copies int;
  v_max_borrows int;
  v_unpaid_fines boolean;
begin
  -- 1. Check for unpaid fines
  select exists (
    select 1 from public.borrow_history
    where user_id = p_user_id and fine_status = 'unpaid'
  ) into v_unpaid_fines;

  if v_unpaid_fines then
    raise exception 'You have unpaid fines. Please clear your dues before borrowing more books.';
  end if;

  -- 2. Get user's dynamic limit
  select t.max_borrows into v_max_borrows
  from public.users u
  join public.membership_tiers t on u.tier_id = t.id
  where u.id = p_user_id;

  -- Fallback to default if not found
  if v_max_borrows is null then
    v_max_borrows := 5;
  end if;

  -- 3. Check current active count
  select count(*) into v_active_count
  from public.borrow_history
  where user_id = p_user_id
    and status in ('requested', 'active', 'overdue');
    
  if v_active_count >= v_max_borrows then
    raise exception 'You have reached your limit of % borrowed books.', v_max_borrows;
  end if;

  -- 4. Check if user already has an active request/borrow for THIS book
  if exists (
    select 1 from public.borrow_history
    where user_id = p_user_id
      and book_id = p_book_id
      and status in ('requested', 'active', 'overdue')
  ) then
    raise exception 'You already have an active request or borrow for this book.';
  end if;

  -- 5. Check availability
  select available_copies into v_available_copies
  from public.book_details
  where id = p_book_id;

  if v_available_copies <= 0 then
    if not exists (select 1 from public.waitlist where user_id = p_user_id and book_id = p_book_id) then
      insert into public.waitlist (user_id, book_id) values (p_user_id, p_book_id);
      return 'WAITLISTED';
    else
      return 'ALREADY_ON_WAITLIST';
    end if;
  end if;

  -- 6. Create request
  insert into public.borrow_history (user_id, book_id, status)
  values (p_user_id, p_book_id, 'requested');

  return 'REQUESTED';
end;
$$;

-- ============================================================================
-- 5. Update return_book to calculate fines
-- ============================================================================
create or replace function public.return_book(p_book_id int, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrow_record record;
  v_fine_rate decimal(10, 2);
  v_overdue_days int;
  v_fine decimal(10, 2) := 0;
begin
  -- 1. Find the active borrow record
  select * into v_borrow_record
  from public.borrow_history
  where user_id = p_user_id 
    and book_id = p_book_id 
    and status in ('active', 'overdue')
  limit 1;

  if not found then
    raise exception 'No active borrow found for this book.';
  end if;

  -- 2. Calculate fine if overdue
  if now() > v_borrow_record.due_date then
    v_overdue_days := extract(day from (now() - v_borrow_record.due_date));
    
    -- Get fine rate for user's tier
    select t.daily_fine_rate into v_fine_rate
    from public.users u
    join public.membership_tiers t on u.tier_id = t.id
    where u.id = p_user_id;

    v_fine := v_overdue_days * coalesce(v_fine_rate, 10.00);
  end if;

  -- 3. Perform return
  update public.borrow_history
  set 
    status = 'returned',
    returned_at = now(),
    fine_amount = v_fine,
    fine_status = case when v_fine > 0 then 'unpaid'::text else 'none'::text end
  where id = v_borrow_record.id;

  return case when v_fine > 0 then 'RETURNED_WITH_FINE' else 'RETURNED' end;
end;
$$;

commit;
