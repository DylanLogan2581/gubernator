-- Migration: add_settlement_images
-- Adds flag + seal imagery for settlements (#1373), mirroring the nation-images
-- pattern (20260829000000_add_nation_flag_image.sql +
-- 20261026000000_scope_nation_flag_path_writes.sql): nullable path columns on
-- public.settlements, a private storage bucket, RLS-equivalent storage
-- policies on storage.objects, and SECURITY DEFINER set-path RPCs.
--
-- Path convention enforced below: objects live at
-- "<settlement_id>/flag.<ext>" or "<settlement_id>/seal.<ext>". The first path
-- segment is parsed back to a uuid to resolve which settlement an object
-- belongs to; a malformed segment resolves to null, which every helper treats
-- as "no access" rather than raising.
--
-- Read authority is world membership (a settlement reaches its world through
-- its nation); write authority (insert/update/delete) is delegated to
-- public.current_user_manages_settlement(), which admits super admins, world
-- admins, and the settlement's own settlement_manager / parent nation_manager
-- citizens.
-- ---------------------------------------------------------------------------
alter table public.settlements
add column flag_path text,
add column seal_path text;

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
    'settlement-images',
    'settlement-images',
    false,
    2097152, -- 2 MiB; client downscales before upload so this is a hard backstop.
    array['image/*']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.settlement_images_path_settlement_id (name text) returns uuid language plpgsql immutable as $$
begin
  return ((string_to_array(name, '/'))[1])::uuid;
exception
  when others then
    return null;
end;
$$;

comment on function public.settlement_images_path_settlement_id (text) is 'Parses the leading "<settlement_id>/" path segment of a storage.objects.name value in the settlement-images bucket. Returns null (never raises) for malformed input so RLS predicates degrade to "deny" instead of erroring.';

-- Resolves the world a settlement-images object belongs to (settlement ->
-- nation -> world). SECURITY DEFINER so the settlements/nations lookup inside
-- the read policy is not itself gated by those tables' RLS -- a settlement
-- manager can read their nation's world_id here even though nations RLS would
-- not surface the parent nation row to them directly.
create or replace function public.settlement_images_world_id (p_name text) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select n.world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = public.settlement_images_path_settlement_id (p_name)
$$;

-- ---------------------------------------------------------------------------
-- storage.objects policies (settlement-images bucket only)
-- ---------------------------------------------------------------------------
create policy "settlement_images_select_member" on storage.objects for
select
  to authenticated using (
    bucket_id = 'settlement-images'
    and public.current_user_has_world_access (
      public.settlement_images_world_id (storage.objects.name)
    )
  );

create policy "settlement_images_insert_manager" on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'settlement-images'
    and array_length(string_to_array(name, '/'), 1) = 2
    and public.current_user_manages_settlement (
      public.settlement_images_path_settlement_id (name)
    )
    and (storage.filename (name)) ~ '^(flag|seal)\.[a-zA-Z0-9]+$'
  );

create policy "settlement_images_update_manager" on storage.objects
for update
  to authenticated using (
    bucket_id = 'settlement-images'
    and public.current_user_manages_settlement (
      public.settlement_images_path_settlement_id (name)
    )
  )
with
  check (
    bucket_id = 'settlement-images'
    and array_length(string_to_array(name, '/'), 1) = 2
    and public.current_user_manages_settlement (
      public.settlement_images_path_settlement_id (name)
    )
    and (storage.filename (name)) ~ '^(flag|seal)\.[a-zA-Z0-9]+$'
  );

create policy "settlement_images_delete_manager" on storage.objects for delete to authenticated using (
  bucket_id = 'settlement-images'
  and public.current_user_manages_settlement (
    public.settlement_images_path_settlement_id (name)
  )
);

-- ---------------------------------------------------------------------------
-- set_settlement_flag_path / set_settlement_seal_path: settlements_update_world_admin
-- only grants direct UPDATE to world admins/super admins, so these SECURITY
-- DEFINER RPCs are how a settlement's own manager (in addition to admins) sets
-- or clears the path after a storage upload/removal. Each validates the path
-- references the settlement's own prefix to prevent in-world display spoofing.
-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_flag_path (p_settlement_id uuid, p_flag_path text) returns setof public.settlements language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_settlement_id is null then
    return;
  end if;

  select n.world_id into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    return;
  end if;

  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'You do not have permission to manage this settlement.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_flag_path is not null and p_flag_path !~ ('^' || p_settlement_id::text || '/flag\.') then
    raise exception 'flag_path must reference the settlement''s own storage prefix.'
      using errcode = '22023';
  end if;

  return query
  update public.settlements
  set flag_path = p_flag_path
  where id = p_settlement_id
  returning *;
end;
$$;

create or replace function public.set_settlement_seal_path (p_settlement_id uuid, p_seal_path text) returns setof public.settlements language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_settlement_id is null then
    return;
  end if;

  select n.world_id into v_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    return;
  end if;

  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'You do not have permission to manage this settlement.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_seal_path is not null and p_seal_path !~ ('^' || p_settlement_id::text || '/seal\.') then
    raise exception 'seal_path must reference the settlement''s own storage prefix.'
      using errcode = '22023';
  end if;

  return query
  update public.settlements
  set seal_path = p_seal_path
  where id = p_settlement_id
  returning *;
end;
$$;

revoke all on function public.settlement_images_world_id (text)
from
  public;

grant
execute on function public.settlement_images_world_id (text) to authenticated;

revoke all on function public.set_settlement_flag_path (uuid, text)
from
  public;

revoke all on function public.set_settlement_seal_path (uuid, text)
from
  public;

grant
execute on function public.set_settlement_flag_path (uuid, text) to authenticated;

grant
execute on function public.set_settlement_seal_path (uuid, text) to authenticated;
