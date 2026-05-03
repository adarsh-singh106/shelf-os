-- Follow-up fix: keep RLS strict, but allow member borrow/return RPC flows.
-- Reason: with SECURITY INVOKER and admin-only write policy on borrow_history,
-- request_borrow/return_book fail for normal members.

begin;

-- Make member-facing RPCs run with definer privileges.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('request_borrow', 'return_book')
  loop
    execute format('alter function %s security definer;', fn);
    execute format('alter function %s set search_path = public;', fn);
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;

-- Keep admin confirmation path tied to caller role (RLS + policy).
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'confirm_borrow'
  loop
    execute format('alter function %s security invoker;', fn);
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;

-- mark_overdue should not be callable by normal clients.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mark_overdue'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated;', fn);
  end loop;
end $$;

commit;
