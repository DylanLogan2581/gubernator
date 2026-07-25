-- Migration: add_nation_seal_image
-- Adds a seal image for nations (#1373), reusing the private nation-images
-- bucket introduced in 20260829000000_add_nation_flag_image.sql (later scoped
-- by 20261026000000_scope_nation_flag_path_writes.sql). A seal is a second
-- object under the same "<nation_id>/" prefix, distinguished only by its
-- filename ("seal.<ext>" vs "flag.<ext>"), so the existing bucket, path
-- helper, and per-nation read/write authority all carry over unchanged — only
-- the filename regex on the insert/update policies must widen to admit seals.
-- ---------------------------------------------------------------------------
alter table public.nations
add column seal_path text;

-- ---------------------------------------------------------------------------
-- Widen the insert/update filename regex from flag-only to flag-or-seal. The
-- two-segment and current_user_manages_nation checks are unchanged from
-- 20261026000000_scope_nation_flag_path_writes.sql.
-- ---------------------------------------------------------------------------
drop policy "nation_images_insert_manager" on storage.objects;

create policy "nation_images_insert_manager" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'nation-images'
    and array_length(string_to_array(name, '/'), 1) = 2
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
    and (storage.filename (name)) ~ '^(flag|seal)\.[a-zA-Z0-9]+$'
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
    and (storage.filename (name)) ~ '^(flag|seal)\.[a-zA-Z0-9]+$'
  );

-- ---------------------------------------------------------------------------
-- set_nation_seal_path: mirrors set_nation_flag_path (nations_update_world_admin
-- only grants direct UPDATE to world admins/super admins, so the nation's own
-- nation_manager citizen reaches nations.seal_path through this SECURITY
-- DEFINER RPC). Validates the path references the nation's own prefix to
-- prevent in-world display spoofing.
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_seal_path (p_nation_id uuid, p_seal_path text) returns setof public.nations language plpgsql security definer
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

  if p_seal_path is not null and p_seal_path !~ ('^' || p_nation_id::text || '/seal\.') then
    raise exception 'seal_path must reference the nation''s own storage prefix.'
      using errcode = '22023';
  end if;

  return query
  update public.nations
  set seal_path = p_seal_path
  where id = p_nation_id
  returning *;
end;
$$;

revoke all on function public.set_nation_seal_path (uuid, text)
from
  public;

grant
execute on function public.set_nation_seal_path (uuid, text) to authenticated;
