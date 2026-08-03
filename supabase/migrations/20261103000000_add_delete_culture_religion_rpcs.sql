-- Migration: add_delete_culture_religion_rpcs
-- Issue #1172: deleting a culture/religion currently just relies on the
-- ON DELETE SET NULL on citizens.culture_id / citizens.religion_id and
-- nations.primary_culture_id / nations.state_religion_id (20260919000000,
-- 20260920000000), silently clearing references with no way to reassign
-- them first. These SECURITY DEFINER RPCs add an atomic
-- reassign-then-delete option, gated by the same authority as the existing
-- *_delete_world_admin RLS policies (world admin or super admin). Passing
-- a null reassignment target keeps the old clear-on-delete behavior --
-- direct table deletes (still permitted by RLS) are unaffected.
-- ---------------------------------------------------------------------------
create or replace function public.delete_culture (
  p_culture_id uuid,
  p_reassign_to_id uuid default null
) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_culture_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select c.world_id into v_world_id
  from public.cultures c
  where c.id = p_culture_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'archived worlds are read-only' using errcode = '22023';
  end if;

  if p_reassign_to_id is not null then
    if p_reassign_to_id = p_culture_id then
      raise exception 'cannot reassign to the culture being deleted'
        using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.cultures c
      where c.id = p_reassign_to_id
        and c.world_id = v_world_id
    ) then
      raise exception 'reassignment target does not belong to this world'
        using errcode = 'P0001';
    end if;

    update public.citizens
    set culture_id = p_reassign_to_id
    where culture_id = p_culture_id;

    update public.nations
    set primary_culture_id = p_reassign_to_id
    where primary_culture_id = p_culture_id;
  end if;

  delete from public.cultures c where c.id = p_culture_id;

  return query select p_culture_id, v_world_id;
end;
$$;

revoke all on function public.delete_culture (uuid, uuid)
from
  public;

grant
execute on function public.delete_culture (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_religion: mirrors delete_culture above for religions.
-- ---------------------------------------------------------------------------
create or replace function public.delete_religion (
  p_religion_id uuid,
  p_reassign_to_id uuid default null
) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_religion_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select r.world_id into v_world_id
  from public.religions r
  where r.id = p_religion_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'archived worlds are read-only' using errcode = '22023';
  end if;

  if p_reassign_to_id is not null then
    if p_reassign_to_id = p_religion_id then
      raise exception 'cannot reassign to the religion being deleted'
        using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.religions r
      where r.id = p_reassign_to_id
        and r.world_id = v_world_id
    ) then
      raise exception 'reassignment target does not belong to this world'
        using errcode = 'P0001';
    end if;

    update public.citizens
    set religion_id = p_reassign_to_id
    where religion_id = p_religion_id;

    update public.nations
    set state_religion_id = p_reassign_to_id
    where state_religion_id = p_religion_id;
  end if;

  delete from public.religions r where r.id = p_religion_id;

  return query select p_religion_id, v_world_id;
end;
$$;

revoke all on function public.delete_religion (uuid, uuid)
from
  public;

grant
execute on function public.delete_religion (uuid, uuid) to authenticated;
