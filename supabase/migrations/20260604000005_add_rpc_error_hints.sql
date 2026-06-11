-- Migration: add_rpc_error_hints
-- Adds structured HINT values to every application-level RAISE EXCEPTION in
-- start_turn_transition and apply_turn_transition so that callers can identify
-- specific error conditions via error.hint rather than substring-matching the
-- human-readable message text. Closes review finding M8 (issue #517).
--
-- Hint values added:
--   'world_archived'      – world is archived and cannot be advanced
--   'stale_expected_turn' – stale expected turn number mismatch
--   'state_drifted'       – stockpile quantity diverged between state-load and RPC call
-- ---------------------------------------------------------------------------
-- start_turn_transition -------------------------------------------------------
create or replace function public.start_turn_transition (p_world_id uuid, p_expected_turn_number integer) returns uuid language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition_id uuid;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  -- Auth: only super admins and world admins may drive the simulation
  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = 'insufficient_privilege';
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

  -- Insert running transition; on concurrent duplicate reuse the existing row
  begin
    insert into
      public.turn_transitions (
        world_id,
        from_turn_number,
        to_turn_number,
        initiated_by_user_id,
        status
      )
    values
      (
        p_world_id,
        p_expected_turn_number,
        p_expected_turn_number + 1,
        auth.uid (),
        'running'
      )
    returning
      id into v_transition_id;
  exception
    when unique_violation then
      select
        tt.id into v_transition_id
      from
        public.turn_transitions tt
      where
        tt.world_id = p_world_id
        and tt.from_turn_number = p_expected_turn_number
        and tt.status = 'running'
      order by
        tt.started_at desc
      limit
        1;
  end;

  return v_transition_id;
end;
$$;

revoke
execute on function public.start_turn_transition (uuid, integer)
from
  public;

grant
execute on function public.start_turn_transition (uuid, integer) to authenticated;

-- apply_turn_transition -------------------------------------------------------
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
  -- §C28 stockpile-delta loop variables
  v_delta jsonb;
  v_settlement_id uuid;
  v_resource_id uuid;
  v_quantity_before numeric(18, 4);
  v_quantity_after numeric(18, 4);
  v_produced_amount numeric(18, 4);
  v_consumed_amount numeric(18, 4);
  v_trade_in_amount numeric(18, 4);
  v_trade_out_amount numeric(18, 4);
  v_effective_cap numeric;
  v_clamped_quantity numeric(18, 4);
  v_stockpile_delta_count integer := 0;
  -- §H9 stockpile re-validation
  v_actual_quantity numeric(18, 4);
  -- §C29 construction / building patch loop variables
  v_update jsonb;
  v_project_id uuid;
  v_project_status text;
  v_progress_worker_turns numeric(18, 4);
  v_activated_on_turn_number integer;
  v_construction_update_count integer := 0;
  v_building_blueprint_id uuid;
  v_tier_id uuid;
  v_source_project_id uuid;
  v_buildings_created_count integer := 0;
  v_building_id uuid;
  v_building_state text;
  v_missed_upkeep_count integer;
  v_building_state_change_count integer := 0;
  -- §C30 deposit / managed-population patch loop variables
  v_resource_delta jsonb;
  v_deposit_instance_id uuid;
  v_deposit_status text;
  v_amount_delta numeric(18, 4);
  v_deposit_update_count integer := 0;
  v_managed_pop_instance_id uuid;
  v_count_delta numeric(18, 4);
  v_managed_pop_status text;
  v_managed_pop_update_count integer := 0;
  -- §C31 trade route outcome loop variables
  v_route_outcome jsonb;
  v_trade_route_id uuid;
  v_trade_route_status text;
  v_pause_reason text;
  v_trade_route_outcome_count integer := 0;
  -- §C32 citizen / partnership patch loop variables
  v_backfill jsonb;
  v_backfill_citizen_id uuid;
  v_backfill_born_on_turn_number integer;
  v_backfill_count integer := 0;
  v_birth jsonb;
  v_birth_settlement_id uuid;
  v_birth_name text;
  v_birth_sex text;
  v_birth_born_on_turn_number integer;
  v_parent_a_citizen_id uuid;
  v_parent_b_citizen_id uuid;
  v_npc_trait_1 text;
  v_npc_trait_2 text;
  v_npc_secret_contradiction text;
  v_npc_goal text;
  v_npc_flaw text;
  v_citizen_birth_count integer := 0;
  v_death jsonb;
  v_citizen_id uuid;
  v_citizen_type text;
  v_citizen_status text;
  v_death_cause_category public.death_cause_category;
  v_death_cause text;
  v_citizen_death_count integer := 0;
  v_partnership_change jsonb;
  v_partner_a_id uuid;
  v_partner_b_id uuid;
  v_partnership_id uuid;
  v_partnership_to_status text;
  v_formed_on_turn_number integer;
  v_ended_on_turn_number integer;
  v_partnership_change_count integer := 0;
  v_assignment_clear jsonb;
  v_assignment_clear_count integer := 0;
  v_overshoot_stamp_count integer := 0;
  -- §C33 log entry / notification loop variables
  v_log_entry_count integer := 0;
  v_notification jsonb;
  v_notif_type public.notification_type;
  v_notif_message text;
  v_notif_scope text;
  v_notif_settlement_id uuid;
  v_notif_nation_id uuid;
  v_notification_count integer := 0;
  -- §C34 settlement snapshot count
  v_settlement_snapshot_count integer := 0;
  -- §C35 readiness reset count
  v_readiness_reset_count integer := 0;
  -- §C36 cross-world guard: id-sets per entity table
  v_valid_settlement_ids uuid[];
  v_valid_resource_ids uuid[];
  v_valid_project_ids uuid[];
  v_valid_building_ids uuid[];
  v_valid_deposit_instance_ids uuid[];
  v_valid_managed_pop_instance_ids uuid[];
  v_valid_trade_route_ids uuid[];
  v_valid_citizen_ids uuid[];
  v_check_id uuid;
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

  -- Auth: only super admins and world admins may drive the simulation
  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = 'insufficient_privilege';
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

  -- stockpileDeltas: settlementId, resourceId
  for v_delta in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
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

  -- constructionUpdates: projectId
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'constructionUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'projectId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_project_ids)) then
      raise exception 'cross-world id % in constructionUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- buildingsCreated: settlementId
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- buildingStateChanges: buildingId
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'buildingStateChanges', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'buildingId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_ids)) then
      raise exception 'cross-world id % in buildingStateChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- depositUpdates: depositInstanceId
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'depositInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_deposit_instance_ids)) then
      raise exception 'cross-world id % in depositUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- managedPopulationUpdates: managedPopulationInstanceId
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_managed_pop_instance_ids)) then
      raise exception 'cross-world id % in managedPopulationUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- tradeRouteOutcomes: tradeRouteId
  for v_route_outcome in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
  loop
    v_check_id := (v_route_outcome ->> 'tradeRouteId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_trade_route_ids)) then
      raise exception 'cross-world id % in tradeRouteOutcomes', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- bornOnTurnBackfill: citizenId
  for v_backfill in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_check_id := (v_backfill ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in bornOnTurnBackfill', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- citizenBirths: settlementId, parentACitizenId (nullable), parentBCitizenId (nullable)
  for v_birth in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
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

  -- citizenDeaths: citizenId
  for v_death in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_check_id := (v_death ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenDeaths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- partnershipChanges: citizenAId, citizenBId
  for v_partnership_change in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
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

  -- assignmentClears: citizenId
  for v_assignment_clear in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_check_id := (v_assignment_clear ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in assignmentClears', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §H9: Stockpile quantityBefore re-validation (issue #506).
  -- After the world lock, re-read each live stockpile quantity and compare to the
  -- quantityBefore the engine computed from. A mismatch means another mutation
  -- committed between state-load and this RPC call; raise P0001 so the caller
  -- retries with fresh state rather than silently overwriting the concurrent change.
  -- This check is outside the failure-capture block so a drift failure leaves the
  -- transition in 'running' status for retry (matching §C36 placement rationale).
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

  -- Outer failure-capture block: any unhandled exception inside marks the transition
  -- failed so callers can distinguish a partial run from success.
  begin
    -- §C28: Apply stockpile deltas.
    for v_delta in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
    loop
      v_settlement_id    := (v_delta ->> 'settlementId')::uuid;
      v_resource_id      := (v_delta ->> 'resourceId')::uuid;
      v_quantity_before  := coalesce((v_delta ->> 'quantityBefore')::numeric, 0);
      v_quantity_after   := coalesce((v_delta ->> 'quantityAfter')::numeric, 0);
      v_produced_amount  := coalesce((v_delta ->> 'produced')::numeric, 0);
      v_consumed_amount  := coalesce((v_delta ->> 'consumed')::numeric, 0);
      v_trade_in_amount  := coalesce((v_delta ->> 'tradeIn')::numeric, 0);
      v_trade_out_amount := coalesce((v_delta ->> 'tradeOut')::numeric, 0);

      -- Server-side clamp to [0, effective_cap] (defence-in-depth; engine already clamps)
      v_effective_cap    := public.settlement_effective_storage_cap(v_settlement_id, v_resource_id);
      v_clamped_quantity := greatest(0, least(v_quantity_after, v_effective_cap));

      update public.settlement_resource_stockpiles
      set
        quantity = v_clamped_quantity
      where
        settlement_id = v_settlement_id
        and resource_id = v_resource_id;

      insert into
        public.settlement_turn_resource_snapshots (
          turn_transition_id,
          world_id,
          settlement_id,
          resource_id,
          turn_number,
          quantity_before,
          quantity_after,
          produced_amount,
          consumed_amount,
          trade_in_amount,
          trade_out_amount
        )
      values
        (
          v_transition.id,
          p_world_id,
          v_settlement_id,
          v_resource_id,
          p_expected_turn_number,
          v_quantity_before,
          v_clamped_quantity,
          v_produced_amount,
          v_consumed_amount,
          v_trade_in_amount,
          v_trade_out_amount
        ) on conflict on constraint settlement_turn_resource_snapshots_unique do nothing;

      v_stockpile_delta_count := v_stockpile_delta_count + 1;
    end loop;

    -- §C29a: Apply construction project updates.
    for v_update in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'constructionUpdates', '[]'::jsonb))
    loop
      v_project_id               := (v_update ->> 'projectId')::uuid;
      v_project_status           := v_update ->> 'status';
      v_progress_worker_turns    := coalesce((v_update ->> 'progressWorkerTurns')::numeric, 0);
      v_activated_on_turn_number := (v_update ->> 'activatedOnTurnNumber')::integer;

      update public.construction_projects
      set
        status                     = v_project_status,
        progress_worker_turns      = v_progress_worker_turns,
        completed_in_transition_id = case
          when v_project_status = 'complete' then v_transition.id
          else null
        end,
        activated_on_turn_number   = v_activated_on_turn_number
      where
        id = v_project_id;

      v_construction_update_count := v_construction_update_count + 1;
    end loop;

    -- §C29b: Insert newly created buildings.
    for v_update in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
    loop
      v_settlement_id         := (v_update ->> 'settlementId')::uuid;
      v_building_blueprint_id := (v_update ->> 'buildingBlueprintId')::uuid;
      v_tier_id               := (v_update ->> 'currentTierId')::uuid;
      v_source_project_id     := (v_update ->> 'sourceProjectId')::uuid;

      insert into public.settlement_buildings (
        settlement_id,
        building_blueprint_id,
        current_tier_id,
        source_project_id,
        state,
        missed_upkeep_count,
        activated_on_turn_number
      ) values (
        v_settlement_id,
        v_building_blueprint_id,
        v_tier_id,
        v_source_project_id,
        'active',
        0,
        v_transition.to_turn_number
      );

      v_buildings_created_count := v_buildings_created_count + 1;
    end loop;

    -- §C29c: Apply building state changes.
    for v_update in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'buildingStateChanges', '[]'::jsonb))
    loop
      v_building_id         := (v_update ->> 'buildingId')::uuid;
      v_building_state      := v_update ->> 'state';
      v_missed_upkeep_count := coalesce((v_update ->> 'missedUpkeepCount')::integer, 0);

      update public.settlement_buildings
      set
        state                        = v_building_state,
        missed_upkeep_count          = v_missed_upkeep_count,
        deactivated_in_transition_id = case
          when v_building_state != 'active' then v_transition.id
          else null
        end
      where
        id = v_building_id;

      v_building_state_change_count := v_building_state_change_count + 1;
    end loop;

    -- §C30a: Apply deposit updates.
    for v_update in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
    loop
      v_deposit_instance_id := (v_update ->> 'depositInstanceId')::uuid;
      v_deposit_status      := v_update ->> 'toStatus';

      for v_resource_delta in
        select value
        from jsonb_array_elements(coalesce(v_update -> 'resourceDeltas', '[]'::jsonb))
      loop
        v_resource_id  := (v_resource_delta ->> 'resourceId')::uuid;
        v_amount_delta := coalesce((v_resource_delta ->> 'delta')::numeric, 0);

        update public.deposit_instance_resources
        set
          remaining_quantity = greatest(0, remaining_quantity + v_amount_delta)
        where
          deposit_instance_id = v_deposit_instance_id
          and resource_id = v_resource_id;
      end loop;

      if v_deposit_status is not null then
        update public.deposit_instances
        set
          status = v_deposit_status
        where
          id = v_deposit_instance_id;

        if v_deposit_status = 'depleted' then
          delete from public.citizen_assignments
          where
            deposit_instance_id = v_deposit_instance_id;
        end if;
      end if;

      v_deposit_update_count := v_deposit_update_count + 1;
    end loop;

    -- §C30b: Apply managed population updates.
    for v_update in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
    loop
      v_managed_pop_instance_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
      v_count_delta             := coalesce((v_update ->> 'countDelta')::numeric, 0);
      v_managed_pop_status      := v_update ->> 'toStatus';

      update public.managed_population_instances
      set
        current_count = greatest(0, current_count + v_count_delta),
        status        = coalesce(v_managed_pop_status, status)
      where
        id = v_managed_pop_instance_id;

      if v_managed_pop_status = 'extinct' then
        delete from public.citizen_assignments
        where
          managed_population_instance_id = v_managed_pop_instance_id;
      end if;

      v_managed_pop_update_count := v_managed_pop_update_count + 1;
    end loop;

    -- §C31: Apply trade route outcome patches.
    for v_route_outcome in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
    loop
      v_trade_route_id     := (v_route_outcome ->> 'tradeRouteId')::uuid;
      v_trade_route_status := v_route_outcome ->> 'toStatus';
      v_pause_reason       := v_route_outcome ->> 'pauseReason';

      if v_trade_route_status not in ('active', 'paused') then
        raise exception 'trade route status must be active or paused, got %', v_trade_route_status
          using errcode = 'P0001';
      end if;

      update public.trade_routes
      set
        status                       = v_trade_route_status,
        pause_reason_last_transition = v_pause_reason
      where
        id = v_trade_route_id;

      v_trade_route_outcome_count := v_trade_route_outcome_count + 1;
    end loop;

    -- §C32 pre-pass: Apply born_on_turn_number backfill for existing citizens.
    for v_backfill in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
    loop
      v_backfill_citizen_id          := (v_backfill ->> 'citizenId')::uuid;
      v_backfill_born_on_turn_number := (v_backfill ->> 'bornOnTurnNumber')::integer;

      update public.citizens
      set
        born_on_turn_number = v_backfill_born_on_turn_number
      where
        id = v_backfill_citizen_id;

      v_backfill_count := v_backfill_count + 1;
    end loop;

    -- §C32a: Apply citizen births.
    for v_birth in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
    loop
      v_birth_settlement_id       := (v_birth ->> 'settlementId')::uuid;
      v_birth_name                := v_birth ->> 'name';
      v_birth_sex                 := v_birth ->> 'sex';
      v_birth_born_on_turn_number := (v_birth ->> 'bornOnTurnNumber')::integer;
      v_parent_a_citizen_id       := (v_birth ->> 'parentACitizenId')::uuid;
      v_parent_b_citizen_id       := (v_birth ->> 'parentBCitizenId')::uuid;
      v_npc_trait_1               := v_birth ->> 'npcTrait1';
      v_npc_trait_2               := v_birth ->> 'npcTrait2';
      v_npc_secret_contradiction  := v_birth ->> 'npcSecretContradiction';
      v_npc_goal                  := v_birth ->> 'npcGoal';
      v_npc_flaw                  := v_birth ->> 'npcFlaw';

      perform public.create_citizen_internal (
        p_world_id,
        v_birth_settlement_id,
        'npc',
        v_birth_name,
        v_birth_sex,
        null,
        v_birth_born_on_turn_number,
        v_parent_a_citizen_id,
        v_parent_b_citizen_id,
        null,
        null,
        null,
        v_npc_trait_1,
        v_npc_trait_2,
        v_npc_secret_contradiction,
        v_npc_goal,
        v_npc_flaw
      );

      v_citizen_birth_count := v_citizen_birth_count + 1;
    end loop;

    -- §C32b: Apply citizen deaths.
    -- Defense-in-depth: raises P0001 when the target is a player character — the
    -- simulation engine must never mark a PC dead; this guard catches engine bugs.
    for v_death in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
    loop
      v_citizen_id           := (v_death ->> 'citizenId')::uuid;
      v_death_cause_category := (v_death ->> 'deathCauseCategory')::public.death_cause_category;
      v_death_cause          := v_death ->> 'deathCause';

      select c.citizen_type
      into v_citizen_type
      from public.citizens c
      where c.id = v_citizen_id;

      if v_citizen_type = 'player_character' then
        raise exception 'simulation engine may not kill a player character (citizen %)', v_citizen_id
          using errcode = 'P0001';
      end if;

      update public.citizens
      set
        status               = 'dead',
        death_cause_category = v_death_cause_category,
        death_cause          = v_death_cause
      where
        id = v_citizen_id;

      v_citizen_death_count := v_citizen_death_count + 1;
    end loop;

    -- §C32c: Apply partnership changes.
    -- Defense-in-depth (issue #499 / H1): a 'formed' entry whose citizen_a or
    -- citizen_b is already dead at this point in the transaction (e.g. they also
    -- appeared in citizenDeaths, applied above) is rejected with P0001.
    -- The engine fix in phasePartnerships.ts prevents this, but this guard
    -- catches engine bugs before they corrupt partnership rows.
    for v_partnership_change in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
    loop
      v_partner_a_id          := (v_partnership_change ->> 'citizenAId')::uuid;
      v_partner_b_id          := (v_partnership_change ->> 'citizenBId')::uuid;
      v_partnership_to_status := v_partnership_change ->> 'toStatus';
      v_formed_on_turn_number := (v_partnership_change ->> 'formedOnTurnNumber')::integer;
      v_ended_on_turn_number  := (v_partnership_change ->> 'endedOnTurnNumber')::integer;

      if v_partnership_to_status = 'active' then
        select c.status into v_citizen_status
        from public.citizens c
        where c.id = v_partner_a_id;

        if v_citizen_status = 'dead' then
          raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_a_id
            using errcode = 'P0001';
        end if;

        select c.status into v_citizen_status
        from public.citizens c
        where c.id = v_partner_b_id;

        if v_citizen_status = 'dead' then
          raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_b_id
            using errcode = 'P0001';
        end if;

        insert into public.partnerships (
          citizen_a_id,
          citizen_b_id,
          status,
          formed_on_turn_number
        )
        values (
          v_partner_a_id,
          v_partner_b_id,
          'active',
          v_formed_on_turn_number
        );
      else
        select p.id
        into v_partnership_id
        from public.partnerships p
        where (
          (p.citizen_a_id = v_partner_a_id and p.citizen_b_id = v_partner_b_id)
          or (p.citizen_a_id = v_partner_b_id and p.citizen_b_id = v_partner_a_id)
        )
        and p.status = 'active';

        update public.partnerships
        set
          status               = v_partnership_to_status,
          ended_on_turn_number = v_ended_on_turn_number
        where
          id = v_partnership_id;
      end if;

      v_partnership_change_count := v_partnership_change_count + 1;
    end loop;

    -- §C32d: Apply assignment clears.
    for v_assignment_clear in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
    loop
      v_citizen_id := (v_assignment_clear ->> 'citizenId')::uuid;

      delete from public.citizen_assignments
      where
        citizen_id = v_citizen_id;

      v_assignment_clear_count := v_assignment_clear_count + 1;
    end loop;

    -- §C32e: Stamp manual_deconstruct_overshoot log entries written out-of-band.
    update public.turn_log_entries
    set
      turn_transition_id = v_transition.id
    where
      world_id = p_world_id
      and log_category = 'manual_deconstruct_overshoot'
      and turn_transition_id is null;

    get diagnostics v_overshoot_stamp_count = row_count;

    -- §C33a: Bulk-insert simulation log entries.
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      settlement_id,
      nation_id,
      citizen_id,
      resource_id,
      log_category,
      payload_jsonb
    )
    select
      v_transition.id,
      p_world_id,
      (entry.value ->> 'settlementId')::uuid,
      (entry.value ->> 'nationId')::uuid,
      (entry.value ->> 'citizenId')::uuid,
      (entry.value ->> 'resourceId')::uuid,
      entry.value ->> 'category',
      coalesce(entry.value -> 'payload', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_payload -> 'logEntries', '[]'::jsonb)) as entry
    where entry.value ->> 'category' is not null;

    get diagnostics v_log_entry_count = row_count;

    -- §C33b: Fan out simulation notifications to scoped recipients.
    for v_notification in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'notifications', '[]'::jsonb))
    loop
      v_notif_type          := (v_notification ->> 'notificationType')::public.notification_type;
      v_notif_message       := v_notification ->> 'messageText';
      v_notif_scope         := v_notification ->> 'scope';
      v_notif_settlement_id := (v_notification ->> 'settlementId')::uuid;
      v_notif_nation_id     := (v_notification ->> 'nationId')::uuid;

      if v_notif_scope = 'settlement'
         and v_notif_settlement_id is not null
         and v_notif_nation_id is null
      then
        select s.nation_id
        into v_notif_nation_id
        from public.settlements s
        where s.id = v_notif_settlement_id;
      end if;

      insert into public.notifications (
        recipient_user_id,
        world_id,
        nation_id,
        settlement_id,
        notification_type,
        message_text,
        generated_in_transition_id
      )
      select
        recipients.user_id,
        p_world_id,
        v_notif_nation_id,
        v_notif_settlement_id,
        v_notif_type,
        v_notif_message,
        v_transition.id
      from (
        select c.user_id
        from public.citizens c
        inner join public.users u on u.id = c.user_id
        where v_notif_scope = 'settlement'
          and v_notif_settlement_id is not null
          and c.role_type = 'settlement_manager'
          and c.role_settlement_id = v_notif_settlement_id
          and c.status = 'alive'
          and c.citizen_type = 'player_character'
          and c.user_id is not null
          and u.status = 'active'
        union
        select c.user_id
        from public.citizens c
        inner join public.users u on u.id = c.user_id
        where v_notif_scope in ('settlement', 'nation')
          and v_notif_nation_id is not null
          and c.role_type = 'nation_manager'
          and c.role_nation_id = v_notif_nation_id
          and c.status = 'alive'
          and c.citizen_type = 'player_character'
          and c.user_id is not null
          and u.status = 'active'
        union
        select w.owner_id
        from public.worlds w
        inner join public.users u on u.id = w.owner_id
        where w.id = p_world_id
          and u.status = 'active'
        union
        select wa.user_id
        from public.world_admins wa
        inner join public.users u on u.id = wa.user_id
        where wa.world_id = p_world_id
          and u.status = 'active'
        union
        select u.id
        from public.users u
        where u.is_super_admin = true
          and u.status = 'active'
      ) as recipients (user_id)
      on conflict (
        generated_in_transition_id,
        recipient_user_id,
        notification_type,
        coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) where generated_in_transition_id is not null
      do nothing;

      v_notification_count := v_notification_count + 1;
    end loop;

    -- §C34: Bulk-insert settlement snapshots.
    insert into public.settlement_turn_snapshots (
      turn_transition_id,
      world_id,
      settlement_id,
      turn_number,
      population_total,
      population_npc,
      population_player_character,
      population_cap,
      birth_count,
      death_count,
      starvation_deaths_count,
      homeless_deaths_count,
      partnerships_formed_count,
      managed_populations_summary_json,
      buildings_summary_json,
      trade_summary_json,
      warnings_summary_json
    )
    select
      v_transition.id,
      p_world_id,
      (snap.value ->> 'settlementId')::uuid,
      (snap.value ->> 'turnNumber')::integer,
      (snap.value ->> 'aliveTotal')::integer,
      (snap.value ->> 'aliveNpc')::integer,
      (snap.value ->> 'alivePc')::integer,
      (snap.value ->> 'populationCap')::integer,
      coalesce((snap.value ->> 'birthCount')::integer, 0),
      coalesce((snap.value ->> 'deathCount')::integer, 0),
      coalesce((snap.value ->> 'starvationDeathsCount')::integer, 0),
      coalesce((snap.value ->> 'homelessDeathsCount')::integer, 0),
      coalesce((snap.value ->> 'partnershipsFormedCount')::integer, 0),
      snap.value -> 'managedPopulationSummary',
      snap.value -> 'buildingSummary',
      snap.value -> 'tradeSummary',
      snap.value -> 'warnings'
    from jsonb_array_elements(coalesce(p_payload -> 'settlementSnapshots', '[]'::jsonb)) as snap
    where (snap.value ->> 'settlementId') is not null
    on conflict (turn_transition_id, settlement_id)
      where turn_transition_id is not null
    do nothing;

    get diagnostics v_settlement_snapshot_count = row_count;

    -- §C35a: Advance the world turn number.
    update public.worlds
    set
      current_turn_number = p_expected_turn_number + 1
    where
      id = p_world_id;

    -- §C35b: Reset settlement readiness for the new turn.
    update public.settlements s
    set
      is_ready_current_turn   = s.auto_ready_enabled,
      ready_set_at            = null,
      ready_set_by_citizen_id = null
    from
      public.nations n
    where
      n.id = s.nation_id
      and n.world_id = p_world_id;

    get diagnostics v_readiness_reset_count = row_count;

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

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid)
from
  public;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid) to authenticated;
