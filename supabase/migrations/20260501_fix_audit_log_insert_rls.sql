-- Fix: allow audit trigger inserts under RLS.
-- Symptom: "new row violates row-level security policy for table audit_log"
-- during admin handover / confirm_borrow flow.

begin;

drop policy if exists "audit_log_insert_admin_or_self_or_system" on public.audit_log;

create policy "audit_log_insert_admin_or_self_or_system"
on public.audit_log
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or changed_by = auth.uid()
  or changed_by is null
);

commit;
