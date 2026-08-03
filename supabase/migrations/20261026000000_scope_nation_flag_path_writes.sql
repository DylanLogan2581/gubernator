-- Migration: scope_nation_flag_path_writes
-- Fixes #1148: the nation-images insert/update storage policies added in
-- 20260829000000_add_nation_flag_image.sql only regex-check the final path
-- segment (storage.filename), so a manager could write arbitrarily nested
-- junk under their own nation prefix (e.g. "<nation_id>/a/b/flag.png") — no
-- cross-nation write, but unbounded object litter. Separately,
-- set_nation_flag_path accepted arbitrary text, letting a manager point
-- flag_path at another nation's object (in-world display spoofing; reads
-- remain world-gated).
--
-- Fix: require exactly two path segments on insert/update, and validate
-- p_flag_path starts with "<p_nation_id>/flag." in the RPC.
-- ---------------------------------------------------------------------------
drop policy "nation_images_insert_manager" on storage.objects;

create policy "nation_images_insert_manager" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'nation-images'
    and array_length(string_to_array(name, '/'), 1) = 2
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
    and (storage.filename (name)) ~ '^flag\.[a-zA-Z0-9]+$'
  );

drop policy "nation_images_update_manager" on storage.objects;

create policy "nation_images_update_manager" on storage.objects
for update
  to authenticated using (
    bucket_id = 'nation-images'
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
  )
with
  check (
    bucket_id = 'nation-images'
    and array_length(string_to_array(name, '/'), 1) = 2
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
    and (storage.filename (name)) ~ '^flag\.[a-zA-Z0-9]+$'
  );

create or replace function public.set_nation_flag_path (p_nation_id uuid, p_flag_path text) returns setof public.nations language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_nation_id is null then
    return;
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    return;
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_flag_path is not null and p_flag_path !~ ('^' || p_nation_id::text || '/flag\.') then
    raise exception 'flag_path must reference the nation''s own storage prefix.'
      using errcode = '22023';
  end if;

  return query
  update public.nations
  set flag_path = p_flag_path
  where id = p_nation_id
  returning *;
end;
$$;
