-- Migration: refactor_apply_turn_transition_helpers
-- Issue #529 / review finding M23.
--
-- Extracts each mutation phase (§C28–§C35) of apply_turn_transition into its
-- own private SECURITY DEFINER helper. The top-level function becomes a thin
-- orchestrator: auth, world lock, transition lookup, §C36 cross-world guard,
-- §H9 stockpile re-validation, then one call per helper, then completion.
--
-- All helpers are revoked from public (and therefore from authenticated).
-- They are only reachable via apply_turn_transition, which runs as the
-- function owner (postgres) and therefore has implicit execute on all
-- functions owned by the same role.
-- ---------------------------------------------------------------------------
-- ############################################################
-- §C28 — Stockpile deltas
-- ############################################################
create or replace function public.internal_apply_turn_transition_stockpile_deltas (
  p_transition_id uuid,
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
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
  v_count integer := 0;
begin
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

    -- Server-side clamp to [0, effective_cap] (defence-in-depth; engine already clamps).
    -- Use _internal variant: auth was already verified by the orchestrator.
    v_effective_cap    := public.settlement_effective_storage_cap_internal(v_settlement_id, v_resource_id);
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
        p_transition_id,
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

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C29 — Construction and building patches
-- ############################################################
create or replace function public.internal_apply_turn_transition_construction_patches (
  p_transition_id uuid,
  p_to_turn_number integer,
  p_payload jsonb,
  out construction_update_count integer,
  out buildings_created_count integer,
  out building_state_change_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_update jsonb;
  v_project_id uuid;
  v_project_status text;
  v_progress_worker_turns numeric(18, 4);
  v_activated_on_turn_number integer;
  v_settlement_id uuid;
  v_building_blueprint_id uuid;
  v_tier_id uuid;
  v_source_project_id uuid;
  v_building_id uuid;
  v_building_state text;
  v_missed_upkeep_count integer;
begin
  construction_update_count   := 0;
  buildings_created_count     := 0;
  building_state_change_count := 0;

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
        when v_project_status = 'complete' then p_transition_id
        else null
      end,
      activated_on_turn_number   = v_activated_on_turn_number
    where
      id = v_project_id;

    construction_update_count := construction_update_count + 1;
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
      p_to_turn_number
    );

    buildings_created_count := buildings_created_count + 1;
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
        when v_building_state != 'active' then p_transition_id
        else null
      end
    where
      id = v_building_id;

    building_state_change_count := building_state_change_count + 1;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_construction_patches (uuid, integer, jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C30 — Deposit and managed-population patches
-- ############################################################
create or replace function public.internal_apply_turn_transition_deposit_managed_pop_patches (
  p_payload jsonb,
  out deposit_update_count integer,
  out managed_pop_update_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_update jsonb;
  v_resource_delta jsonb;
  v_deposit_instance_id uuid;
  v_deposit_status text;
  v_resource_id uuid;
  v_amount_delta numeric(18, 4);
  v_managed_pop_instance_id uuid;
  v_count_delta numeric(18, 4);
  v_managed_pop_status text;
begin
  deposit_update_count     := 0;
  managed_pop_update_count := 0;

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

    deposit_update_count := deposit_update_count + 1;
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

    managed_pop_update_count := managed_pop_update_count + 1;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_deposit_managed_pop_patches (jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C31 — Trade route outcome patches
-- ############################################################
create or replace function public.internal_apply_turn_transition_trade_route_patches (p_payload jsonb) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_route_outcome jsonb;
  v_trade_route_id uuid;
  v_trade_route_status text;
  v_pause_reason text;
  v_count integer := 0;
begin
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

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_trade_route_patches (jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C32 — Citizen and partnership patches
-- ############################################################
create or replace function public.internal_apply_turn_transition_citizen_partnership_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_payload jsonb,
  out backfill_count integer,
  out citizen_birth_count integer,
  out citizen_death_count integer,
  out partnership_change_count integer,
  out assignment_clear_count integer,
  out overshoot_stamp_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_backfill jsonb;
  v_backfill_citizen_id uuid;
  v_backfill_born_on_turn_number integer;
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
  v_death jsonb;
  v_citizen_id uuid;
  v_citizen_type text;
  v_citizen_status text;
  v_death_cause_category public.death_cause_category;
  v_death_cause text;
  v_partnership_change jsonb;
  v_partner_a_id uuid;
  v_partner_b_id uuid;
  v_partnership_id uuid;
  v_partnership_to_status text;
  v_formed_on_turn_number integer;
  v_ended_on_turn_number integer;
  v_assignment_clear jsonb;
begin
  backfill_count           := 0;
  citizen_birth_count      := 0;
  citizen_death_count      := 0;
  partnership_change_count := 0;
  assignment_clear_count   := 0;
  overshoot_stamp_count    := 0;

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

    backfill_count := backfill_count + 1;
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

    citizen_birth_count := citizen_birth_count + 1;
  end loop;

  -- §C32b: Apply citizen deaths.
  -- Defense-in-depth: raises P0001 when the target is a player character.
  -- M18: explicit not-found guard prevents stale v_citizen_type carry-over.
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

    if not found then
      raise exception 'citizen % not found', v_citizen_id using errcode = 'P0001';
    end if;

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

    citizen_death_count := citizen_death_count + 1;
  end loop;

  -- §C32c: Apply partnership changes.
  -- Defense-in-depth (H1): 'active' entries with dead partners are rejected.
  -- M18: explicit not-found guards on citizen and partnership lookups.
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

      if not found then
        raise exception 'citizen % not found', v_partner_a_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_a_id
          using errcode = 'P0001';
      end if;

      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_b_id;

      if not found then
        raise exception 'citizen % not found', v_partner_b_id using errcode = 'P0001';
      end if;

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

      if not found then
        raise exception 'active partnership between % and % not found', v_partner_a_id, v_partner_b_id
          using errcode = 'P0001';
      end if;

      update public.partnerships
      set
        status               = v_partnership_to_status,
        ended_on_turn_number = v_ended_on_turn_number
      where
        id = v_partnership_id;
    end if;

    partnership_change_count := partnership_change_count + 1;
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

    assignment_clear_count := assignment_clear_count + 1;
  end loop;

  -- §C32e: Stamp manual_deconstruct_overshoot log entries written out-of-band.
  update public.turn_log_entries
  set
    turn_transition_id = p_transition_id
  where
    world_id = p_world_id
    and log_category = 'manual_deconstruct_overshoot'
    and turn_transition_id is null;

  get diagnostics overshoot_stamp_count = row_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_citizen_partnership_patches (uuid, uuid, jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C33 — Log entries and notification fan-out
-- ############################################################
create or replace function public.internal_apply_turn_transition_log_entries_and_notifications (
  p_transition_id uuid,
  p_world_id uuid,
  p_payload jsonb,
  out log_entry_count integer,
  out notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_notification jsonb;
  v_notif_type public.notification_type;
  v_notif_message text;
  v_notif_scope text;
  v_notif_settlement_id uuid;
  v_notif_nation_id uuid;
begin
  log_entry_count    := 0;
  notification_count := 0;

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
    p_transition_id,
    p_world_id,
    (entry.value ->> 'settlementId')::uuid,
    (entry.value ->> 'nationId')::uuid,
    (entry.value ->> 'citizenId')::uuid,
    (entry.value ->> 'resourceId')::uuid,
    entry.value ->> 'category',
    coalesce(entry.value -> 'payload', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_payload -> 'logEntries', '[]'::jsonb)) as entry
  where entry.value ->> 'category' is not null;

  get diagnostics log_entry_count = row_count;

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
      p_transition_id
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

    notification_count := notification_count + 1;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C34 — Settlement turn snapshots
-- ############################################################
create or replace function public.internal_apply_turn_transition_settlement_snapshots (
  p_transition_id uuid,
  p_world_id uuid,
  p_payload jsonb
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_count integer := 0;
begin
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
    p_transition_id,
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

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_settlement_snapshots (uuid, uuid, jsonb)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- §C35 — Advance world turn and reset settlement readiness
-- ############################################################
create or replace function public.internal_apply_turn_transition_advance_world_turn (p_world_id uuid, p_expected_turn_number integer) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_count integer := 0;
begin
  -- §C35a: Advance the world turn number.
  update public.worlds
  set
    current_turn_number = p_expected_turn_number + 1
  where
    id = p_world_id;

  -- §C35b: Reset settlement readiness for the new turn.
  -- is_ready_current_turn mirrors auto_ready_enabled; ready_set_at and
  -- ready_set_by_citizen_id are always cleared so manual overrides don't
  -- bleed into the next turn.
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

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_advance_world_turn (uuid, integer)
from
  public;

-- intentionally no grant to authenticated — internal use only
-- ############################################################
-- Thin orchestrator: apply_turn_transition
-- ############################################################
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
      v_transition.id, p_world_id, p_payload
    );

    -- §C34
    v_settlement_snapshot_count := public.internal_apply_turn_transition_settlement_snapshots (
      v_transition.id, p_world_id, p_payload
    );

    -- §C35
    v_readiness_reset_count := public.internal_apply_turn_transition_advance_world_turn (
      p_world_id, p_expected_turn_number
    );

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

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid) to authenticated;
