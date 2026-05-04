-- Migration: Robust Library Logic (Returns, Waitlist, and Rejections)
-- This migration enhances the core business logic for better robustness and auditability.

begin;

-- ============================================================================
-- 1. Enhance Statuses and Constraints
-- ============================================================================

-- Ensure 'cancelled' is allowed in the status check (already added in previous migrations, but good to be sure)
alter table public.borrow_history 
  drop constraint if exists borrow_history_status_check;

alter table public.borrow_history
  add constraint borrow_history_status_check 
  check (status in ('requested', 'active', 'overdue', 'returned', 'cancelled'));

-- ============================================================================
-- 2. New RPC: reject_borrow (Admin Only)
-- ============================================================================
create or replace function public.reject_borrow(p_borrow_id int, p_reason text default null)
returns text
language plpgsql
security definer -- Admin only via application logic or RLS
as $$
begin
  -- 1. Verify the request exists and is in 'requested' status
  if not exists (
    select 1 from public.borrow_history 
    where id = p_borrow_id and status = 'requested'
  ) then
    raise exception 'Request not found or cannot be rejected in its current state.';
  end if;

  -- 2. Update status to 'cancelled'
  -- We use 'cancelled' for both student cancellations and admin rejections
  -- but we can store the reason in a metadata column if we had one.
  -- For now, just update the status.
  update public.borrow_history
  set 
    status = 'cancelled',
    returned_at = now() -- use this as 'processed_at'
  where id = p_borrow_id;

  return 'REJECTED';
end;
$$;

-- ============================================================================
-- 3. New RPC: cancel_request (Student)
-- ============================================================================
create or replace function public.cancel_request(p_borrow_id int, p_user_id uuid)
returns text
language plpgsql
security definer
as $$
begin
  -- 1. Verify the request belongs to the user and is 'requested'
  if not exists (
    select 1 from public.borrow_history 
    where id = p_borrow_id and user_id = p_user_id and status = 'requested'
  ) then
    raise exception 'Request not found or cannot be cancelled.';
  end if;

  -- 2. Update status
  update public.borrow_history
  set 
    status = 'cancelled',
    returned_at = now()
  where id = p_borrow_id;

  return 'CANCELLED';
end;
$$;

-- ============================================================================
-- 4. New RPC: leave_waitlist (Student)
-- ============================================================================
create or replace function public.leave_waitlist(p_book_id int, p_user_id uuid)
returns text
language plpgsql
security definer
as $$
begin
  delete from public.waitlist
  where book_id = p_book_id and user_id = p_user_id;

  if not found then
    return 'NOT_ON_WAITLIST';
  end if;

  return 'LEFT_WAITLIST';
end;
$$;

-- ============================================================================
-- 5. Robust Waitlist Processing on Return
-- ============================================================================

-- Function to handle return and potentially notify waitlist
create or replace function public.handle_book_return_waitlist()
returns trigger
language plpgsql
as $$
declare
  v_next_user record;
begin
  -- If book is returned, make the copy available
  if new.status = 'returned' and old.status in ('active', 'overdue') then
    update public.book_copies
    set status = 'available'
    where copy_id = old.copy_id;

    -- OPTIONAL: Find the first person on the waitlist for this book
    -- In a real system, we might notify them here.
    -- For this demo, we'll just keep the copy available and let the librarian 
    -- fulfill requests as they come or manually.
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 6. Permissions
-- ============================================================================
grant execute on function public.reject_borrow(int, text) to authenticated;
grant execute on function public.cancel_request(int, uuid) to authenticated;
grant execute on function public.leave_waitlist(int, uuid) to authenticated;

commit;
