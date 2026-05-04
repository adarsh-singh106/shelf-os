-- Migration: Add waitlist_count to book_details view
-- This allows us to easily see how many people are waiting for a book.

begin;

drop view if exists public.book_details;

create view public.book_details as
with book_authors_agg as (
  select ba.book_id, array_agg(a.name) as authors_arr, string_agg(a.name, ' ') as authors_str
  from public.book_authors ba
  join public.authors a on ba.author_id = a.id
  group by ba.book_id
),
book_genres_agg as (
  select bg.book_id, array_agg(g.name) as genres_arr, string_agg(g.name, ' ') as genres_str
  from public.book_genres bg
  join public.genres g on bg.genre_id = g.id
  group by bg.book_id
)
select
  b.id,
  b.title,
  b.isbn,
  b.description,
  b.cover_url,
  b.format,
  b.language,
  b.published_date,
  b.avg_rating,
  b.review_count,
  p.name as publisher_name,
  coalesce(ba.authors_arr, '{}') as authors,
  coalesce(bg.genres_arr, '{}') as genres,
  (select count(*) from public.book_copies bc where bc.book_id = b.id) as total_copies,
  (select count(*) from public.book_copies bc where bc.book_id = b.id and bc.status = 'available') as available_copies,
  (select count(*) from public.waitlist w where w.book_id = b.id) as waitlist_count,
  concat_ws(' ', b.title, b.isbn, ba.authors_str, bg.genres_str) as searchable_text
from public.books b
left join public.publishers p on b.publisher_id = p.id
left join book_authors_agg ba on b.id = ba.book_id
left join book_genres_agg bg on b.id = bg.book_id;

commit;
