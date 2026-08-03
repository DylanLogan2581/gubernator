-- Migration: add_nation_flag_image
-- Adds a flag image for nations (#1072), mirroring the world-images pattern
-- (20260821000000_add_world_images.sql): a nullable path column on
-- public.nations, a private storage bucket, and RLS-equivalent storage
-- policies on storage.objects.
--
-- Path convention enforced by the policies below: objects live at
-- "<nation_id>/flag.<ext>". The first path segment is parsed back to a uuid
-- to resolve which nation an object belongs to; a malformed segment resolves
-- to null, which every helper treats as "no access" rather than raising.
--
-- Write authority (insert/update/delete) is delegated to
-- public.current_user_manages_nation(), which already admits super admins,
-- world admins of the nation's world, and the nation's own nation_manager
-- citizen (see 20260522000001_extend_rls_permission_helpers.sql) — no
-- separate admin-or-manager check is needed here.
-- ---------------------------------------------------------------------------
alter table public.nations
add column flag_path text;

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
    'nation-images',
    'nation-images',
    false,
    2097152, -- 2 MiB; client downscales before upload so this is a hard backstop.
    array['image/*']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.nation_images_path_nation_id (name text) returns uuid language plpgsql immutable as $$
begin
  return ((string_to_array(name, '/'))[1])::uuid;
exception
  when others then
    return null;
end;
$$;

comment on function public.nation_images_path_nation_id (text) is 'Parses the leading "<nation_id>/" path segment of a storage.objects.name value in the nation-images bucket. Returns null (never raises) for malformed input so RLS predicates degrade to "deny" instead of erroring.';

-- ---------------------------------------------------------------------------
-- storage.objects policies (nation-images bucket only)
-- ---------------------------------------------------------------------------
create policy "nation_images_select_member" on storage.objects for
select
  to authenticated using (
    bucket_id = 'nation-images'
    and exists (
      select
        1
      from
        public.nations n
      where
        n.id = public.nation_images_path_nation_id (storage.objects.name)
        and public.current_user_has_world_access (n.world_id)
    )
  );

create policy "nation_images_insert_manager" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'nation-images'
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
    and (storage.filename (name)) ~ '^flag\.[a-zA-Z0-9]+$'
  );

create policy "nation_images_update_manager" on storage.objects
for update
  to authenticated using (
    bucket_id = 'nation-images'
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
  )
with
  check (
    bucket_id = 'nation-images'
    and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
    and (storage.filename (name)) ~ '^flag\.[a-zA-Z0-9]+$'
  );

create policy "nation_images_delete_manager" on storage.objects for delete to authenticated using (
  bucket_id = 'nation-images'
  and public.current_user_manages_nation (public.nation_images_path_nation_id (name))
);

-- ---------------------------------------------------------------------------
-- set_nation_flag_path: writes nations.flag_path. nations_update_world_admin
-- only grants direct UPDATE to world admins/super admins (see
-- 20260502000001_add_nations.sql), so — mirroring
-- set_nation_capital_and_founded_turn in
-- 20260828000000_add_nation_capital_and_founded_turn.sql — this SECURITY
-- DEFINER RPC is how the nation's own nation_manager citizen (in addition to
-- admins) is able to set/clear the flag path after a storage upload/removal.
-- ---------------------------------------------------------------------------
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

  return query
  update public.nations
  set flag_path = p_flag_path
  where id = p_nation_id
  returning *;
end;
$$;

revoke all on function public.set_nation_flag_path (uuid, text)
from
  public;

grant
execute on function public.set_nation_flag_path (uuid, text) to authenticated;
