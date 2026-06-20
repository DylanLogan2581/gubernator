-- Migration: preview_world_delete_rpc
-- Issue #799: Add preview_world_delete RPC for cascade-delete dry-run.
--
-- Returns row counts for the major dependent tables that will be cascade-
-- deleted when hard_delete_world runs. Superadmin only.
-- Acceptance criterion: "cascade preview counts match actual deletion".
-- ---------------------------------------------------------------------------
create or replace function public.preview_world_delete (p_world_id uuid) returns jsonb language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into v_world from public.worlds where id = p_world_id;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object (
    'worldId',    p_world_id,
    'worldName',  v_world.name,
    'isTrashed',  v_world.is_trashed,

    -- direct world-scoped counts
    'nations',          (select count (*) from public.nations          where world_id = p_world_id),
    'resources',        (select count (*) from public.resources        where world_id = p_world_id),
    'jobDefinitions',   (select count (*) from public.job_definitions  where world_id = p_world_id),
    'buildingBlueprints', (select count (*) from public.building_blueprints where world_id = p_world_id),
    'depositTypes',     (select count (*) from public.deposit_types    where world_id = p_world_id),
    'managedPopulationTypes', (select count (*) from public.managed_population_types where world_id = p_world_id),
    'namesets',         (select count (*) from public.namesets         where world_id = p_world_id),
    'tradeRoutes',      (
      select count (*)
      from public.trade_routes tr
      join public.settlements s on s.id = tr.origin_settlement_id
      join public.nations n on n.id = s.nation_id
      where n.world_id = p_world_id
    ),
    'eventGroups',      (select count (*) from public.event_groups     where world_id = p_world_id),
    'turnTransitions',  (select count (*) from public.turn_transitions where world_id = p_world_id),
    'notifications',    (select count (*) from public.notifications    where world_id = p_world_id),
    'worldAdmins',      (select count (*) from public.world_admins     where world_id = p_world_id),

    -- nested counts (via nation → settlement chain)
    'settlements',      (
      select count (*)
      from public.settlements s
      join public.nations n on n.id = s.nation_id
      where n.world_id = p_world_id
    ),
    'citizens',         (
      select count (*)
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
      join public.nations n on n.id = s.nation_id
      where n.world_id = p_world_id
    ),
    'settlementTurnSnapshots', (
      select count (*)
      from public.settlement_turn_snapshots sts
      where sts.world_id = p_world_id
    ),
    'turnLogEntries',   (
      select count (*)
      from public.turn_log_entries tle
      where tle.world_id = p_world_id
    )
  );
end;
$$;

revoke all on function public.preview_world_delete (uuid)
from
  public;

grant
execute on function public.preview_world_delete (uuid) to authenticated;
