-- Migration: Update book_details view with Publisher info (FIXED)
-- We use DROP VIEW and then CREATE VIEW because the column order/names changed,
-- and Postgres 'CREATE OR REPLACE' doesn't allow changing existing column structures.

begin;

drop view if exists public.book_details;

create view public.book_details as
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
  (
    select array_agg(a.name)
    from public.book_authors ba
    join public.authors a on ba.author_id = a.id
    where ba.book_id = b.id
  ) as authors,
  (
    select array_agg(g.name)
    from public.book_genres bg
    join public.genres g on bg.genre_id = g.id
    where bg.book_id = b.id
  ) as genres,
  (
    select count(*)
    from public.book_copies bc
    where bc.book_id = b.id
  ) as total_copies,
  (
    select count(*)
    from public.book_copies bc
    where bc.book_id = b.id and bc.status = 'available'
  ) as available_copies
from public.books b
left join public.publishers p on b.publisher_id = p.id;

commit;
