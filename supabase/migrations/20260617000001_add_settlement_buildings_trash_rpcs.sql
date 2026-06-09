-- Migration: add_settlement_buildings_trash_rpcs
-- Adds restore / hard_delete RPCs for settlement_buildings, reusing the
-- deconstructed states (auto_deconstructed, manually_deconstructed) as the
-- "trashed" set. Follows the pattern from job_definitions trash lifecycle.
--
-- All functions follow the same conventions:
--   - SECURITY DEFINER with search_path = ''
--   - Row-level lock to prevent concurrent races
--   - Auth guard (world admin or super admin only)
--   - Fail-closed: unknown entity → empty result; blocked hard-delete → EXCEPTION
-- ---------------------------------------------------------------------------
-- restore_settlement_building
-- Returns to active state from any deconstructed state.
-- ---------------------------------------------------------------------------
create or replace function public.restore_settlement_building (p_building_id uuid, p_world_id uuid) returns setof public.settlement_buildings language plpgsql security definer
set
  search_path = '' as $$
declare
  v_building public.settlement_buildings%rowtype;
begin
  if p_building_id is null or p_world_id is null then
    return;
  end if;

  select sb.* into v_building
  from public.settlement_buildings sb
  join public.settlements s on s.id = sb.settlement_id
  join public.nations n on n.id = s.nation_id
  where sb.id = p_building_id and n.world_id = p_world_id
  for update;

  if v_building.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  -- Must be deconstructed to restore.
  if v_building.state not in ('auto_deconstructed', 'manually_deconstructed') then
    return;
  end if;

  return query
  update public.settlement_buildings
  set state = 'active', updated_at = now()
  where id = p_building_id
  returning *;
end;
$$;

-- hard_delete_settlement_building
-- Permanently deletes a building. Must be deconstructed first.
-- ---------------------------------------------------------------------------
create or replace function public.hard_delete_settlement_building (p_building_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_building public.settlement_buildings%rowtype;
begin
  if p_building_id is null or p_world_id is null then
    return;
  end if;

  select sb.* into v_building
  from public.settlement_buildings sb
  join public.settlements s on s.id = sb.settlement_id
  join public.nations n on n.id = s.nation_id
  where sb.id = p_building_id and n.world_id = p_world_id
  for update;

  if v_building.id is null then
    return;
  end if;

  if not (public.is_super_admin() or public.is_world_admin(p_world_id)) then
    return;
  end if;

  -- Building must be deconstructed (in trash) before permanent deletion.
  if v_building.state not in ('auto_deconstructed', 'manually_deconstructed') then
    raise exception 'Building must be deconstructed before it can be permanently deleted.';
  end if;

  return query
  delete from public.settlement_buildings
  where id = p_building_id
  returning id, (select n.world_id from public.settlements s join public.nations n on n.id = s.nation_id where s.id = v_building.settlement_id)::uuid;
end;
$$;

revoke all on function public.restore_settlement_building (uuid, uuid)
from
  public;

revoke all on function public.hard_delete_settlement_building (uuid, uuid)
from
  public;

grant
execute on function public.restore_settlement_building (uuid, uuid) to authenticated;

grant
execute on function public.hard_delete_settlement_building (uuid, uuid) to authenticated;
