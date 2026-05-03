-- Migration: Update user_reading_history view with Fines

begin;

create or replace view public.user_reading_history as
select 
  bh.user_id,
  bh.borrowed_at,
  bh.returned_at,
  bh.due_date,
  bh.status,
  bh.fine_amount,
  bh.fine_status,
  b.title,
  b.cover_url
from public.borrow_history bh
join public.books b on bh.book_id = b.id;

commit;
