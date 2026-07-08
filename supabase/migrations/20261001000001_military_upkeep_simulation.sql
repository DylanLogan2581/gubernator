-- Migration: military_upkeep_simulation
-- #1110: the end-turn simulation gains a military upkeep phase
-- (phaseMilitaryUpkeep, runs after phaseNationalEconomy / phaseManagedPopulations
-- and before phaseCitizenConsumption). Every army pays its per-soldier upkeep
-- from its funding source; a shortfall causes desertion at the unit type's
-- configured rate, and units that hit zero soldiers are disbanded. This
-- migration wires the DB write path:
--   §1: army_turn_snapshots table (soldier_count_total /
--       soldiers_by_unit_type_json / upkeep_paid per army per turn), RLS
--       scoped like armies/army_units (world-access join).
--   §2: internal_apply_turn_transition_military_upkeep -- applies
--       armyTurnSnapshots / desertedSoldiers / disbandedUnits from the
--       simulation payload. Deserted soldiers return to civilian life at
--       their resolved settlement (mirrors discharge_soldiers' update +
--       delete pattern) before their unit_soldiers row is removed; disbanded
--       units are deleted only after every one of their soldiers has already
--       been cleared above, satisfying delete_army_unit's "no soldiers" FK
--       guard.
--   §3: apply_turn_transition -- full redefinition (copied verbatim from
--       20260926000000_education_simulation.sql, the truly-current
--       definition as of this migration) with:
--         - v_valid_army_ids / v_valid_army_unit_ids / v_valid_unit_soldier_ids
--           id-sets
--         - cross-world guards for armyTurnSnapshots, desertedSoldiers,
--           disbandedUnits
--         - a call to internal_apply_turn_transition_military_upkeep
--         - three new patchCounts keys
-- ---------------------------------------------------------------------------
-- §1: army_turn_snapshots
-- ---------------------------------------------------------------------------
create table public.army_turn_snapshots (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  army_id uuid not null references public.armies (id) on delete cascade,
  turn_number integer not null,
  soldier_count_total integer not null,
  soldiers_by_unit_type_json jsonb not null default '{}',
  upkeep_paid boolean not null,
  created_at timestamptz not null default now(),
  constraint army_turn_snapshots_army_turn_unique unique (army_id, turn_number),
  constraint army_turn_snapshots_turn_number_check check (turn_number >= 0),
  constraint army_turn_snapshots_soldier_count_total_check check (soldier_count_total >= 0)
);

create index army_turn_snapshots_world_id_idx on public.army_turn_snapshots (world_id);

create index army_turn_snapshots_army_id_idx on public.army_turn_snapshots (army_id);

alter table public.army_turn_snapshots enable row level security;

-- RLS: SELECT scoped like armies/army_units (plain world-access helper --
-- see 20260929000000's RLS visibility note re: nation-visibility scoping
-- once #1086 lands). No INSERT/UPDATE/DELETE grants -- writes only via
-- apply_turn_transition (security definer, runs as table owner, bypasses
-- RLS and grants), matching nation_turn_snapshots' write path.
create policy "army_turn_snapshots_select_world_access" on public.army_turn_snapshots for
select
  to authenticated using (public.current_user_has_world_access (world_id));

grant
select
  on public.army_turn_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- §2: internal_apply_turn_transition_military_upkeep
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_military_upkeep (
  p_world_id uuid,
  p_turn_number integer,
  p_payload jsonb,
  out army_turn_snapshot_count integer,
  out deserted_soldier_count integer,
  out disbanded_unit_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_snapshot jsonb;
  v_deserted jsonb;
  v_disbanded jsonb;
begin
  army_turn_snapshot_count := 0;
  deserted_soldier_count := 0;
  disbanded_unit_count := 0;

  for v_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'armyTurnSnapshots', '[]'::jsonb))
  loop
    insert into public.army_turn_snapshots (
      world_id, army_id, turn_number, soldier_count_total, soldiers_by_unit_type_json, upkeep_paid
    )
    values (
      p_world_id,
      (v_snapshot ->> 'armyId')::uuid,
      coalesce((v_snapshot ->> 'turnNumber')::integer, p_turn_number),
      (v_snapshot ->> 'soldierCountTotal')::integer,
      coalesce(v_snapshot -> 'soldiersByUnitTypeJson', '{}'::jsonb),
      (v_snapshot ->> 'upkeepPaid')::boolean
    );
    army_turn_snapshot_count := army_turn_snapshot_count + 1;
  end loop;

  -- Deserters return to civilian life at their resolved settlement (mirrors
  -- discharge_soldiers' update-then-delete pattern) before their
  -- unit_soldiers row is removed.
  for v_deserted in
    select value from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
  loop
    update public.citizens
    set settlement_id = (v_deserted ->> 'newSettlementId')::uuid
    where id = (v_deserted ->> 'citizenId')::uuid;

    delete from public.unit_soldiers where id = (v_deserted ->> 'soldierId')::uuid;

    deserted_soldier_count := deserted_soldier_count + 1;
  end loop;

  -- Disbanded units: every soldier they had has already been cleared above
  -- (either paid for or deserted), so the FK/guard on army_units deletion is
  -- satisfied here.
  for v_disbanded in
    select value from jsonb_array_elements(coalesce(p_payload -> 'disbandedUnits', '[]'::jsonb))
  loop
    delete from public.army_units where id = (v_disbanded ->> 'unitId')::uuid;
    disbanded_unit_count := disbanded_unit_count + 1;
  end loop;

  return;
end;
$$;

revoke all on function public.internal_apply_turn_transition_military_upkeep (uuid, integer, jsonb)
from
  public,
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- §3: apply_turn_transition -- full redefinition (see header).
-- ---------------------------------------------------------------------------
create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  p_transition_id uuid,
  p_forecast_snapshot_jsonb jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition public.turn_transitions%rowtype;
  v_result jsonb;
  -- §C36 cross-world guard loop variables (shared across all validation loops)
  v_delta jsonb;
  v_update jsonb;
  v_route_outcome jsonb;
  v_backfill jsonb;
  v_birth jsonb;
  v_death jsonb;
  v_partnership_change jsonb;
  v_assignment_clear jsonb;
  v_nation_snapshot jsonb;
  v_treaty_change jsonb;
  v_currency_snapshot jsonb;
  v_currency_update jsonb;
  v_citizen_education_patch jsonb;
  v_enrollment_progress_update jsonb;
  v_enrollment_graduation jsonb;
  v_army_snapshot jsonb;
  v_deserted_soldier jsonb;
  v_disbanded_unit jsonb;
  v_check_id uuid;
  -- §H9 stockpile re-validation variables
  v_settlement_id uuid;
  v_resource_id uuid;
  v_quantity_before numeric(18, 4);
  v_actual_quantity numeric(18, 4);
  -- §H10a/§H10b deposit & managed-pop re-validation variables (issue #670)
  v_resource_delta jsonb;
  v_deposit_instance_id uuid;
  v_remaining_quantity_before numeric(18, 4);
  v_actual_remaining_quantity numeric(18, 4);
  v_managed_pop_instance_id uuid;
  v_current_count_before numeric(18, 4);
  v_actual_current_count numeric(18, 4);
  -- §C36 id-sets per entity table
  v_valid_settlement_ids uuid[];
  v_valid_resource_ids uuid[];
  v_valid_project_ids uuid[];
  v_valid_building_ids uuid[];
  v_valid_building_blueprint_ids uuid[];
  v_valid_building_blueprint_tier_ids uuid[];
  v_valid_deposit_instance_ids uuid[];
  v_valid_managed_pop_instance_ids uuid[];
  v_valid_trade_route_ids uuid[];
  v_valid_citizen_ids uuid[];
  v_valid_nation_ids uuid[];
  v_valid_treaty_ids uuid[];
  v_valid_currency_ids uuid[];
  v_valid_education_level_ids uuid[];
  v_valid_enrollment_ids uuid[];
  v_valid_army_ids uuid[];
  v_valid_army_unit_ids uuid[];
  v_valid_unit_soldier_ids uuid[];
  -- phase result counts (populated by internal helpers)
  v_stockpile_delta_count integer := 0;
  v_construction_update_count integer := 0;
  v_buildings_created_count integer := 0;
  v_building_state_change_count integer := 0;
  v_deposit_update_count integer := 0;
  v_managed_pop_update_count integer := 0;
  v_trade_route_outcome_count integer := 0;
  v_backfill_count integer := 0;
  v_citizen_birth_count integer := 0;
  v_citizen_death_count integer := 0;
  v_partnership_change_count integer := 0;
  v_assignment_clear_count integer := 0;
  v_overshoot_stamp_count integer := 0;
  v_event_status_update_count integer := 0;
  v_citizen_memory_count integer := 0;
  v_log_entry_count integer := 0;
  v_notification_count integer := 0;
  v_settlement_snapshot_count integer := 0;
  v_readiness_reset_count integer := 0;
  v_nation_readiness_reset_count integer := 0;
  v_nation_readiness_votes_cleared_count integer := 0;
  v_nation_stockpile_delta_count integer := 0;
  v_nation_turn_snapshot_count integer := 0;
  v_treaty_status_change_count integer := 0;
  v_nation_currency_snapshot_count integer := 0;
  v_nation_currency_update_count integer := 0;
  v_nation_currency_notification_count integer := 0;
  v_citizen_education_patch_count integer := 0;
  v_enrollment_progress_update_count integer := 0;
  v_enrollment_graduation_count integer := 0;
  v_army_turn_snapshot_count integer := 0;
  v_deserted_soldier_count integer := 0;
  v_disbanded_unit_count integer := 0;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select
    w.status,
    w.current_turn_number into v_world_status,
    v_world_turn
  from
    public.worlds w
  where
    w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be advanced'
      using errcode = 'P0001', hint = 'world_archived';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number'
      using errcode = 'P0001', hint = 'stale_expected_turn';
  end if;

  -- Look up the pre-created running transition by id.
  select
    tt.* into v_transition
  from
    public.turn_transitions tt
  where
    tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- §C36: Cross-world payload guard (before the failure-capture block so validation
  -- failures leave the transition in 'running' status for retry).
  v_valid_settlement_ids := array(
    select s.id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
    where n.world_id = p_world_id
  );

  v_valid_resource_ids := array(
    select id from public.resources where world_id = p_world_id
  );

  v_valid_project_ids := array(
    select id from public.construction_projects
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_building_ids := array(
    select id from public.settlement_buildings
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_deposit_instance_ids := array(
    select id from public.deposit_instances
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_managed_pop_instance_ids := array(
    select id from public.managed_population_instances
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_trade_route_ids := array(
    select id from public.trade_routes
    where origin_settlement_id = any(v_valid_settlement_ids)
      and destination_settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_citizen_ids := array(
    select id from public.citizens where world_id = p_world_id
  );

  v_valid_building_blueprint_ids := array(
    select id from public.building_blueprints where world_id = p_world_id
  );

  v_valid_building_blueprint_tier_ids := array(
    select t.id from public.building_blueprint_tiers t
    join public.building_blueprints b on b.id = t.building_blueprint_id
    where b.world_id = p_world_id
  );

  v_valid_nation_ids := array(
    select id from public.nations where world_id = p_world_id
  );

  v_valid_treaty_ids := array(
    select id from public.nation_treaties where world_id = p_world_id
  );

  v_valid_currency_ids := array(
    select id from public.nation_currencies where world_id = p_world_id
  );

  v_valid_education_level_ids := array(
    select id from public.education_levels where world_id = p_world_id
  );

  v_valid_enrollment_ids := array(
    select id from public.education_enrollments where world_id = p_world_id
  );

  -- #1110: military upkeep phase id-sets.
  v_valid_army_ids := array(
    select id from public.armies where world_id = p_world_id
  );

  v_valid_army_unit_ids := array(
    select au.id from public.army_units au
    inner join public.armies a on a.id = au.army_id
    where a.world_id = p_world_id
  );

  v_valid_unit_soldier_ids := array(
    select id from public.unit_soldiers where world_id = p_world_id
  );

  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_check_id := (v_delta ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_delta ->> 'resourceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_resource_ids)) then
      raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'constructionUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'projectId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_project_ids)) then
      raise exception 'cross-world id % in constructionUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'buildingBlueprintId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_blueprint_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'currentTierId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_blueprint_tier_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'buildingStateChanges', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'buildingId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_ids)) then
      raise exception 'cross-world id % in buildingStateChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'depositInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_deposit_instance_ids)) then
      raise exception 'cross-world id % in depositUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_managed_pop_instance_ids)) then
      raise exception 'cross-world id % in managedPopulationUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_route_outcome in
    select value from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
  loop
    v_check_id := (v_route_outcome ->> 'tradeRouteId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_trade_route_ids)) then
      raise exception 'cross-world id % in tradeRouteOutcomes', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_backfill in
    select value from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_check_id := (v_backfill ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in bornOnTurnBackfill', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_birth in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_check_id := (v_birth ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_birth ->> 'parentACitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_birth ->> 'parentBCitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_death in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_check_id := (v_death ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenDeaths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_partnership_change in
    select value from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_check_id := (v_partnership_change ->> 'citizenAId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_partnership_change ->> 'citizenBId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_assignment_clear in
    select value from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_check_id := (v_assignment_clear ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in assignmentClears', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1083: nationStockpileDeltas / nationTurnSnapshots cross-world guards.
  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationStockpileDeltas', '[]'::jsonb))
  loop
    v_check_id := (v_delta ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_delta ->> 'resourceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_resource_ids)) then
      raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_nation_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationTurnSnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_nation_snapshot ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationTurnSnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1090: treatyStatusChanges cross-world guard.
  for v_treaty_change in
    select value from jsonb_array_elements(coalesce(p_payload -> 'treatyStatusChanges', '[]'::jsonb))
  loop
    v_check_id := (v_treaty_change ->> 'treatyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_treaty_ids)) then
      raise exception 'cross-world id % in treatyStatusChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1094: nationCurrencySnapshots / nationCurrencyUpdates cross-world guards.
  for v_currency_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencySnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_currency_snapshot ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_currency_snapshot ->> 'currencyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_currency_ids)) then
      raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_currency_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencyUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_currency_update ->> 'currencyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_currency_ids)) then
      raise exception 'cross-world id % in nationCurrencyUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1104: citizenEducationPatches / enrollmentProgressUpdates /
  -- enrollmentGraduations cross-world guards.
  for v_citizen_education_patch in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenEducationPatches', '[]'::jsonb))
  loop
    v_check_id := (v_citizen_education_patch ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenEducationPatches', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_citizen_education_patch ->> 'educationLevelId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_education_level_ids)) then
      raise exception 'cross-world id % in citizenEducationPatches', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_enrollment_progress_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'enrollmentProgressUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_enrollment_progress_update ->> 'enrollmentId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_enrollment_ids)) then
      raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_enrollment_progress_update ->> 'targetLevelId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_education_level_ids)) then
      raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_enrollment_graduation in
    select value from jsonb_array_elements(coalesce(p_payload -> 'enrollmentGraduations', '[]'::jsonb))
  loop
    v_check_id := (v_enrollment_graduation ->> 'enrollmentId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_enrollment_ids)) then
      raise exception 'cross-world id % in enrollmentGraduations', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1110: armyTurnSnapshots / desertedSoldiers / disbandedUnits cross-world guards.
  for v_army_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'armyTurnSnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_army_snapshot ->> 'armyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_ids)) then
      raise exception 'cross-world id % in armyTurnSnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_deserted_soldier in
    select value from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
  loop
    v_check_id := (v_deserted_soldier ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'newSettlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'soldierId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_unit_soldier_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'unitId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_unit_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_disbanded_unit in
    select value from jsonb_array_elements(coalesce(p_payload -> 'disbandedUnits', '[]'::jsonb))
  loop
    v_check_id := (v_disbanded_unit ->> 'armyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_ids)) then
      raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_disbanded_unit ->> 'unitId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_unit_ids)) then
      raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §H9: Stockpile quantityBefore re-validation (issue #506).
  for v_delta in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_settlement_id   := (v_delta ->> 'settlementId')::uuid;
    v_resource_id     := (v_delta ->> 'resourceId')::uuid;
    v_quantity_before := coalesce((v_delta ->> 'quantityBefore')::numeric, 0);

    select srs.quantity
    into v_actual_quantity
    from public.settlement_resource_stockpiles srs
    where srs.settlement_id = v_settlement_id
      and srs.resource_id = v_resource_id;

    if found and v_actual_quantity <> v_quantity_before then
      raise exception 'state diverged: stockpile (%,%) was % but payload claimed %',
        v_settlement_id, v_resource_id, v_actual_quantity, v_quantity_before
        using errcode = 'P0001', hint = 'state_drifted';
    end if;
  end loop;

  -- §H10a: Deposit resource remainingQuantityBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_deposit_instance_id := (v_update ->> 'depositInstanceId')::uuid;

    for v_resource_delta in
      select value
      from jsonb_array_elements(coalesce(v_update -> 'resourceDeltas', '[]'::jsonb))
    loop
      -- Only re-validate when the payload explicitly carries the before-value;
      -- omitting it opts out of drift detection for that delta.
      if v_resource_delta ? 'remainingQuantityBefore' then
        v_resource_id             := (v_resource_delta ->> 'resourceId')::uuid;
        v_remaining_quantity_before := (v_resource_delta ->> 'remainingQuantityBefore')::numeric;

        select dir.remaining_quantity
        into v_actual_remaining_quantity
        from public.deposit_instance_resources dir
        where dir.deposit_instance_id = v_deposit_instance_id
          and dir.resource_id = v_resource_id;

        if found and v_actual_remaining_quantity <> v_remaining_quantity_before then
          raise exception 'state diverged: deposit resource (%,%) was % but payload claimed %',
            v_deposit_instance_id, v_resource_id, v_actual_remaining_quantity, v_remaining_quantity_before
            using errcode = 'P0001', hint = 'state_drifted';
        end if;
      end if;
    end loop;
  end loop;

  -- §H10b: Managed-population currentCountBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    -- Only re-validate when the payload explicitly carries the before-value.
    if v_update ? 'currentCountBefore' then
      v_managed_pop_instance_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
      v_current_count_before    := (v_update ->> 'currentCountBefore')::numeric;

      select mpi.current_count
      into v_actual_current_count
      from public.managed_population_instances mpi
      where mpi.id = v_managed_pop_instance_id;

      if found and v_actual_current_count <> v_current_count_before then
        raise exception 'state diverged: managed-population % was % but payload claimed %',
          v_managed_pop_instance_id, v_actual_current_count, v_current_count_before
          using errcode = 'P0001', hint = 'state_drifted';
      end if;
    end if;
  end loop;

  -- Outer failure-capture block: any unhandled exception inside marks the transition
  -- failed so callers can distinguish a partial run from success.
  begin
    -- §C28
    v_stockpile_delta_count := public.internal_apply_turn_transition_stockpile_deltas (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C29
    select
      construction_update_count,
      buildings_created_count,
      building_state_change_count
    into
      v_construction_update_count,
      v_buildings_created_count,
      v_building_state_change_count
    from public.internal_apply_turn_transition_construction_patches (
      v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C30
    select
      deposit_update_count,
      managed_pop_update_count
    into
      v_deposit_update_count,
      v_managed_pop_update_count
    from public.internal_apply_turn_transition_deposit_managed_pop_patches (p_payload);

    -- §C31
    v_trade_route_outcome_count := public.internal_apply_turn_transition_trade_route_patches (p_payload);

    -- §C32
    select
      backfill_count,
      citizen_birth_count,
      citizen_death_count,
      partnership_change_count,
      assignment_clear_count,
      overshoot_stamp_count
    into
      v_backfill_count,
      v_citizen_birth_count,
      v_citizen_death_count,
      v_partnership_change_count,
      v_assignment_clear_count,
      v_overshoot_stamp_count
    from public.internal_apply_turn_transition_citizen_partnership_patches (
      p_world_id, v_transition.id, p_payload
    );

    -- §C32.5 event status patches + citizen memories
    select event_status_update_count, citizen_memory_count
    into v_event_status_update_count, v_citizen_memory_count
    from public.internal_apply_turn_transition_event_patches(
      p_world_id, v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C33
    select
      log_entry_count,
      notification_count
    into
      v_log_entry_count,
      v_notification_count
    from public.internal_apply_turn_transition_log_entries_and_notifications (
      v_transition.id, p_world_id, p_payload
    );

    -- §C34
    v_settlement_snapshot_count := public.internal_apply_turn_transition_settlement_snapshots (
      v_transition.id, p_world_id, p_payload
    );

    -- §C37: nation economy — credit/debit nation_resource_stockpiles (tax
    -- collection and treaty tribute alike), persist nation_turn_snapshots
    -- (issues #1083, #1090).
    select
      nation_stockpile_delta_count,
      nation_turn_snapshot_count
    into
      v_nation_stockpile_delta_count,
      v_nation_turn_snapshot_count
    from public.internal_apply_turn_transition_nation_economy (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C38: nation currency — persist nation_currency_snapshots, update
    -- nation_currencies.confidence, and insert currency.default /
    -- currency.confidence_collapsing notifications (issue #1094).
    select
      nation_currency_snapshot_count,
      nation_currency_update_count,
      nation_currency_notification_count
    into
      v_nation_currency_snapshot_count,
      v_nation_currency_update_count,
      v_nation_currency_notification_count
    from public.internal_apply_turn_transition_nation_currency (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §1090: treaty status changes — flip expired treaties.
    v_treaty_status_change_count := public.internal_apply_turn_transition_treaty_patches (p_payload);

    -- #1104: education — citizen education-level patches, enrollment
    -- progress updates, and enrollment graduations.
    select
      citizen_education_patch_count,
      enrollment_progress_update_count,
      enrollment_graduation_count
    into
      v_citizen_education_patch_count,
      v_enrollment_progress_update_count,
      v_enrollment_graduation_count
    from public.internal_apply_turn_transition_education_patches (p_payload);

    -- #1110: military upkeep — army_turn_snapshots, deserted-soldier
    -- civilian-return + unit_soldiers cleanup, and unit disband.
    select
      army_turn_snapshot_count,
      deserted_soldier_count,
      disbanded_unit_count
    into
      v_army_turn_snapshot_count,
      v_deserted_soldier_count,
      v_disbanded_unit_count
    from public.internal_apply_turn_transition_military_upkeep (
      p_world_id, v_transition.to_turn_number, p_payload
    );

    -- §C35 / §1076: advance world turn, reset settlement readiness, clear
    -- nation readiness votes and computed readiness for the departing turn.
    select
      settlement_readiness_reset_count,
      nation_readiness_reset_count,
      nation_readiness_votes_cleared_count
    into
      v_readiness_reset_count,
      v_nation_readiness_reset_count,
      v_nation_readiness_votes_cleared_count
    from public.internal_apply_turn_transition_advance_world_turn (
      p_world_id, p_expected_turn_number
    );

    update public.turn_transitions
    set
      status                  = 'completed',
      finished_at             = now (),
      readiness_summary_jsonb = p_payload -> 'readinessSummary',
      forecast_snapshot_jsonb = p_forecast_snapshot_jsonb
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;

    v_result := jsonb_build_object (
      'transitionId',      v_transition.id,
      'fromTurnNumber',    v_transition.from_turn_number,
      'toTurnNumber',      v_transition.to_turn_number,
      'currentTurnNumber', p_expected_turn_number + 1,
      'patchCounts',
      jsonb_build_object (
        'stockpileDeltas',            v_stockpile_delta_count,
        'constructionUpdates',        v_construction_update_count,
        'buildingsCreated',           v_buildings_created_count,
        'buildingStateChanges',       v_building_state_change_count,
        'depositUpdates',             v_deposit_update_count,
        'managedPopulationUpdates',   v_managed_pop_update_count,
        'tradeRouteOutcomes',         v_trade_route_outcome_count,
        'bornOnTurnBackfill',         v_backfill_count,
        'citizenBirths',              v_citizen_birth_count,
        'citizenDeaths',              v_citizen_death_count,
        'partnershipChanges',         v_partnership_change_count,
        'assignmentClears',           v_assignment_clear_count,
        'overshootStamped',           v_overshoot_stamp_count,
        'eventStatusUpdates',         v_event_status_update_count,
        'citizenMemories',            v_citizen_memory_count,
        'logEntries',                 v_log_entry_count,
        'notifications',              v_notification_count,
        'settlementSnapshots',        v_settlement_snapshot_count,
        'readinessReset',             v_readiness_reset_count,
        'nationReadinessReset',       v_nation_readiness_reset_count,
        'nationReadinessVotesCleared', v_nation_readiness_votes_cleared_count,
        'nationStockpileDeltas',      v_nation_stockpile_delta_count,
        'nationTurnSnapshots',        v_nation_turn_snapshot_count,
        'treatyStatusChanges',        v_treaty_status_change_count,
        'nationCurrencySnapshots',    v_nation_currency_snapshot_count,
        'nationCurrencyUpdates',      v_nation_currency_update_count,
        'nationCurrencyNotifications', v_nation_currency_notification_count,
        'citizenEducationPatches',    v_citizen_education_patch_count,
        'enrollmentProgressUpdates',  v_enrollment_progress_update_count,
        'enrollmentGraduations',      v_enrollment_graduation_count,
        'armyTurnSnapshots',          v_army_turn_snapshot_count,
        'desertedSoldiers',           v_deserted_soldier_count,
        'disbandedUnits',             v_disbanded_unit_count
      )
    );
  exception
    when others then
      update public.turn_transitions
      set
        status = 'failed'
      where
        public.turn_transitions.id = v_transition.id
        and public.turn_transitions.status = 'running';

      raise;
  end;

  return v_result;
end;
$$;

revoke all on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  public;

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb) to service_role;
