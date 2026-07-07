-- Migration: add_world_images
-- Adds thumbnail/hero imagery for worlds (#1008): two nullable path columns on
-- public.worlds, a private storage bucket, and RLS-equivalent storage
-- policies on storage.objects that mirror the existing world-access model
-- (public.is_world_admin / public.current_user_has_world_access) rather than
-- introducing a parallel authorization scheme.
--
-- Path convention enforced by the policies below: objects live at
-- "<world_id>/thumbnail.<ext>" or "<world_id>/hero.<ext>". The first path
-- segment is parsed back to a uuid to resolve which world an object belongs
-- to; a malformed segment resolves to null, which every helper treats as "no
-- access" rather than raising.
-- ---------------------------------------------------------------------------
alter table public.worlds
add column thumbnail_path text,
add column hero_path text;

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
insert into
  storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
values
  (
    'world-images',
    'world-images',
    false,
    5242880, -- 5 MiB; client downscales before upload so this is a hard backstop.
    array['image/*']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.world_images_path_world_id (name text) returns uuid language plpgsql immutable as $$
begin
  return ((string_to_array(name, '/'))[1])::uuid;
exception
  when others then
    return null;
end;
$$;

comment on function public.world_images_path_world_id (text) is 'Parses the leading "<world_id>/" path segment of a storage.objects.name value in the world-images bucket. Returns null (never raises) for malformed input so RLS predicates degrade to "deny" instead of erroring.';

-- ---------------------------------------------------------------------------
-- storage.objects policies (world-images bucket only)
-- ---------------------------------------------------------------------------
create policy "world_images_select_member" on storage.objects for
select
  to authenticated using (
    bucket_id = 'world-images'
    and public.current_user_has_world_access (public.world_images_path_world_id (name))
  );

create policy "world_images_insert_admin" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'world-images'
    and public.is_world_admin (public.world_images_path_world_id (name))
    and (storage.filename (name)) ~ '^(thumbnail|hero)\.[a-zA-Z0-9]+$'
  );

create policy "world_images_update_admin" on storage.objects
for update
  to authenticated using (
    bucket_id = 'world-images'
    and public.is_world_admin (public.world_images_path_world_id (name))
  )
with
  check (
    bucket_id = 'world-images'
    and public.is_world_admin (public.world_images_path_world_id (name))
    and (storage.filename (name)) ~ '^(thumbnail|hero)\.[a-zA-Z0-9]+$'
  );

create policy "world_images_delete_admin" on storage.objects for delete to authenticated using (
  bucket_id = 'world-images'
  and public.is_world_admin (public.world_images_path_world_id (name))
);
