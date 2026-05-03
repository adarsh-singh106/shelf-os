-- Migration: Create Book Covers Storage Bucket and RLS Policies

-- 1. Create the bucket (safe to run multiple times with id check)
insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

-- 2. Allow public read access to the book-covers bucket
create policy "Public Read Access"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'book-covers');

-- 3. Allow admins to upload/update/delete covers
create policy "Admin Write Access"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'book-covers' 
  and public.is_admin(auth.uid())
);

create policy "Admin Update Access"
on storage.objects for update
to authenticated
using (
  bucket_id = 'book-covers' 
  and public.is_admin(auth.uid())
);

create policy "Admin Delete Access"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'book-covers' 
  and public.is_admin(auth.uid())
);
