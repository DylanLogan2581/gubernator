-- Migration: apply_turn_transition deposit & managed-pop drift validation
-- Issue #670.
--
-- Extends the drift validation in apply_turn_transition to cover deposit and
-- managed-population deltas, mirroring the existing stockpile quantityBefore
-- re-validation (§H9).
--
-- Gap: apply_turn_transition previously re-validated drift only for
-- stockpileDeltas. Deposit and managed-population updates were applied as
-- simple RELATIVE deltas with no re-check of the before-value, allowing
-- concurrent admin mutations (via set_deposit_instance_resource_quantities or
-- managed-population RPCs) to corrupt state by adding engine-computed delta
-- on top of manual mutation.
--
-- Fix: depositUpdates and managedPopulationUpdates payloads now carry
-- before-values (remainingQuantityBefore, currentCountBefore). apply_turn_transition
-- re-reads live values and raises P0001 hint=state_drifted on mismatch,
-- keeping the transition in 'running' status for retry.
-- ---------------------------------------------------------------------------
-- Drop old signature; create new version with drift validation for deposits
-- and managed populations (§H10a, §H10b)
drop function public.apply_turn_transition (uuid, integer, jsonb, uuid);

create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  p_transition_id uuid
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
  v_resource_delta jsonb;
  v_route_outcome jsonb;
  v_backfill jsonb;
  v_birth jsonb;
  v_death jsonb;
  v_partnership_change jsonb;
  v_assignment_clear jsonb;
  v_check_id uuid;
  -- §H9 stockpile re-validation variables
  v_settlement_id uuid;
  v_resource_id uuid;
  v_quantity_before numeric(18, 4);
  v_actual_quantity numeric(18, 4);
  -- §H10a deposit re-validation variables
  v_deposit_instance_id uuid;
  v_remaining_quantity_before numeric(18, 4);
  v_actual_remaining_quantity numeric(18, 4);
  -- §H10b managed-pop re-validation variables
  v_managed_pop_instance_id uuid;
  v_current_count_before numeric(18, 4);
  v_actual_current_count numeric(18, 4);
  -- §C36 id-sets per entity table
  v_valid_settlement_ids uuid[];
  v_valid_resource_ids uuid[];
  v_valid_project_ids uuid[];
  v_valid_building_ids uuid[];
  v_valid_deposit_instance_ids uuid[];
  v_valid_managed_pop_instance_ids uuid[];
  v_valid_trade_route_ids uuid[];
  v_valid_citizen_ids uuid[];
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
  v_log_entry_count integer := 0;
  v_notification_count integer := 0;
  v_settlement_snapshot_count integer := 0;
  v_readiness_reset_count integer := 0;
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

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'tradeRouteId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_trade_route_ids)) then
      raise exception 'cross-world id % in tradeRouteOutcomes', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'backfillBornOnTurn', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in backfillBornOnTurn', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenDeaths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'partneredCitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'otherPartneredCitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in assignmentClears', v_check_id using errcode = 'P0001';
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
      v_resource_id             := (v_resource_delta ->> 'resourceId')::uuid;
      v_remaining_quantity_before := coalesce((v_resource_delta ->> 'remainingQuantityBefore')::numeric, 0);

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
    end loop;
  end loop;

  -- §H10b: Managed-population currentCountBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    v_managed_pop_instance_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
    v_current_count_before    := coalesce((v_update ->> 'currentCountBefore')::numeric, 0);

    select mpi.current_count
    into v_actual_current_count
    from public.managed_population_instances mpi
    where mpi.id = v_managed_pop_instance_id;

    if found and v_actual_current_count <> v_current_count_before then
      raise exception 'state diverged: managed-population % was % but payload claimed %',
        v_managed_pop_instance_id, v_actual_current_count, v_current_count_before
        using errcode = 'P0001', hint = 'state_drifted';
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

    -- §C33
    select
      log_entry_count,
      notification_count
    into
      v_log_entry_count,
      v_notification_count
    from public.internal_apply_turn_transition_log_entries_and_notifications (
      p_world_id, v_transition.id, p_payload
    );

    -- §C34
    select
      settlement_snapshot_count,
      readiness_reset_count
    into
      v_settlement_snapshot_count,
      v_readiness_reset_count
    from public.internal_apply_turn_transition_settlement_snapshots (
      v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- Mark transition as completed and return result.
    update public.turn_transitions
    set
      status                  = 'completed',
      finished_at             = now (),
      readiness_summary_jsonb = p_payload -> 'readinessSummary'
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
        'stockpileDeltas',          v_stockpile_delta_count,
        'constructionUpdates',      v_construction_update_count,
        'buildingsCreated',         v_buildings_created_count,
        'buildingStateChanges',     v_building_state_change_count,
        'depositUpdates',           v_deposit_update_count,
        'managedPopulationUpdates', v_managed_pop_update_count,
        'tradeRouteOutcomes',       v_trade_route_outcome_count,
        'bornOnTurnBackfill',       v_backfill_count,
        'citizenBirths',            v_citizen_birth_count,
        'citizenDeaths',            v_citizen_death_count,
        'partnershipChanges',       v_partnership_change_count,
        'assignmentClears',         v_assignment_clear_count,
        'overshootStamped',         v_overshoot_stamp_count,
        'logEntries',               v_log_entry_count,
        'notifications',            v_notification_count,
        'settlementSnapshots',      v_settlement_snapshot_count,
        'readinessReset',           v_readiness_reset_count
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

revoke all on function public.apply_turn_transition (uuid, integer, jsonb, uuid)
from
  public;

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid)
from
  anon,
  authenticated;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid) to service_role;
