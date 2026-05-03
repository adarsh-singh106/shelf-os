-- Migration: Fix RPC Function Ambiguity
-- This script drops all versions of request_borrow and return_book 
-- to prevent the "Could not choose the best candidate" error.

begin;

-- 1. Drop all existing versions of these functions
-- We must drop them with their specific parameter types to clear the overloads
drop function if exists public.request_borrow(int, uuid);
drop function if exists public.request_borrow(uuid, int);
drop function if exists public.return_book(int, uuid);
drop function if exists public.return_book(uuid, int);

-- 2. Re-create request_borrow with the correct logic and unified signature
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

-- 3. Re-create return_book with the correct logic and unified signature
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

-- 4. Grant permissions
grant execute on function public.request_borrow(int, uuid) to authenticated;
grant execute on function public.return_book(int, uuid) to authenticated;

commit;
