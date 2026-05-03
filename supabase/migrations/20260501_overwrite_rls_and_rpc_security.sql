-- Overwrite/normalize RLS and RPC security for ShelfOS.
-- Safe to run multiple times.

begin;

-- ============================================================================
-- Helper: admin check
-- ============================================================================
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- ============================================================================
-- Enable RLS on core tables
-- ============================================================================
alter table if exists public.users enable row level security;
alter table if exists public.waitlist enable row level security;
alter table if exists public.borrow_history enable row level security;
alter table if exists public.audit_log enable row level security;
alter table if exists public.books enable row level security;
alter table if exists public.authors enable row level security;
alter table if exists public.genres enable row level security;
alter table if exists public.book_authors enable row level security;
alter table if exists public.book_genres enable row level security;
alter table if exists public.book_copies enable row level security;
alter table if exists public.reviews enable row level security;
alter table if exists public.user_follows enable row level security;

-- ============================================================================
-- Drop existing policies (if any) to avoid conflicts
-- ============================================================================
drop policy if exists "users_select_self_or_admin" on public.users;
drop policy if exists "users_insert_self" on public.users;
drop policy if exists "users_update_self_or_admin" on public.users;

drop policy if exists "waitlist_select_own_or_admin" on public.waitlist;
drop policy if exists "waitlist_insert_own_or_admin" on public.waitlist;
drop policy if exists "waitlist_delete_own_or_admin" on public.waitlist;

drop policy if exists "borrow_history_select_own_or_admin" on public.borrow_history;
drop policy if exists "borrow_history_admin_insert" on public.borrow_history;
drop policy if exists "borrow_history_admin_update" on public.borrow_history;
drop policy if exists "borrow_history_admin_delete" on public.borrow_history;

drop policy if exists "audit_log_admin_select" on public.audit_log;

drop policy if exists "books_public_read" on public.books;
drop policy if exists "books_admin_write" on public.books;
drop policy if exists "authors_public_read" on public.authors;
drop policy if exists "authors_admin_write" on public.authors;
drop policy if exists "genres_public_read" on public.genres;
drop policy if exists "genres_admin_write" on public.genres;
drop policy if exists "book_authors_public_read" on public.book_authors;
drop policy if exists "book_authors_admin_write" on public.book_authors;
drop policy if exists "book_genres_public_read" on public.book_genres;
drop policy if exists "book_genres_admin_write" on public.book_genres;
drop policy if exists "book_copies_public_read" on public.book_copies;
drop policy if exists "book_copies_admin_write" on public.book_copies;
drop policy if exists "reviews_public_read" on public.reviews;
drop policy if exists "reviews_authenticated_write_own" on public.reviews;
drop policy if exists "user_follows_select_own_or_admin" on public.user_follows;
drop policy if exists "user_follows_insert_own" on public.user_follows;
drop policy if exists "user_follows_delete_own_or_admin" on public.user_follows;

-- ============================================================================
-- users
-- ============================================================================
create policy "users_select_self_or_admin"
on public.users
for select
to authenticated
using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "users_insert_self"
on public.users
for insert
to authenticated
with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy "users_update_self_or_admin"
on public.users
for update
to authenticated
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

-- ============================================================================
-- waitlist
-- ============================================================================
create policy "waitlist_select_own_or_admin"
on public.waitlist
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "waitlist_insert_own_or_admin"
on public.waitlist
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "waitlist_delete_own_or_admin"
on public.waitlist
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ============================================================================
-- borrow_history
-- ============================================================================
create policy "borrow_history_select_own_or_admin"
on public.borrow_history
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "borrow_history_admin_insert"
on public.borrow_history
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "borrow_history_admin_update"
on public.borrow_history
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "borrow_history_admin_delete"
on public.borrow_history
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- ============================================================================
-- audit_log
-- ============================================================================
create policy "audit_log_admin_select"
on public.audit_log
for select
to authenticated
using (public.is_admin(auth.uid()));

-- ============================================================================
-- Catalog and relations
-- ============================================================================
create policy "books_public_read"
on public.books
for select
to anon, authenticated
using (true);

create policy "books_admin_write"
on public.books
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "authors_public_read"
on public.authors
for select
to anon, authenticated
using (true);

create policy "authors_admin_write"
on public.authors
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "genres_public_read"
on public.genres
for select
to anon, authenticated
using (true);

create policy "genres_admin_write"
on public.genres
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "book_authors_public_read"
on public.book_authors
for select
to anon, authenticated
using (true);

create policy "book_authors_admin_write"
on public.book_authors
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "book_genres_public_read"
on public.book_genres
for select
to anon, authenticated
using (true);

create policy "book_genres_admin_write"
on public.book_genres
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "book_copies_public_read"
on public.book_copies
for select
to anon, authenticated
using (true);

create policy "book_copies_admin_write"
on public.book_copies
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- ============================================================================
-- reviews
-- ============================================================================
create policy "reviews_public_read"
on public.reviews
for select
to anon, authenticated
using (true);

create policy "reviews_authenticated_write_own"
on public.reviews
for all
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ============================================================================
-- user_follows
-- ============================================================================
create policy "user_follows_select_own_or_admin"
on public.user_follows
for select
to authenticated
using (
  follower_id = auth.uid()
  or followed_id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "user_follows_insert_own"
on public.user_follows
for insert
to authenticated
with check (follower_id = auth.uid() or public.is_admin(auth.uid()));

create policy "user_follows_delete_own_or_admin"
on public.user_follows
for delete
to authenticated
using (follower_id = auth.uid() or public.is_admin(auth.uid()));

-- ============================================================================
-- RPC hardening: revoke anon execution, keep authenticated only.
-- Also force SECURITY INVOKER so table RLS applies.
-- ============================================================================
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('request_borrow', 'confirm_borrow', 'return_book', 'mark_overdue')
  loop
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
    execute format('alter function %s security invoker;', fn);
  end loop;
end $$;

commit;
