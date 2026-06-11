-- Migration: apply_turn_transition_construction_patches
-- §C29: Extends apply_turn_transition to consume constructionUpdates,
-- buildingsCreated, and buildingStateChanges payload keys, advancing
-- construction projects and updating settlement buildings in one atomic
-- transition boundary.
-- ---------------------------------------------------------------------------
create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb
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
    raise exception 'world is archived and cannot be advanced' using errcode = 'P0001';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number' using errcode = 'P0001';
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
      * into v_transition;
  exception
    when unique_violation then
      select
        tt.* into v_transition
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

  -- Outer failure-capture block: any unhandled exception marks the transition
  -- failed so callers can distinguish a partial run from success.
  begin
    -- §C28: Apply stockpile deltas.
    -- Each entry is a ResourceSnapshot-shaped object with camelCase keys produced
    -- by the simulation engine (settlementId, resourceId, quantityBefore,
    -- quantityAfter, produced, consumed, tradeIn, tradeOut).
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
    -- Each entry: projectId, status, progressWorkerTurns, activatedOnTurnNumber (optional).
    -- completed_in_transition_id is derived server-side when status = 'complete'.
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
    -- Each entry: settlementId, buildingBlueprintId, currentTierId, sourceProjectId (optional).
    -- activated_on_turn_number is always derived server-side as v_transition.to_turn_number
    -- (per decision §11.11); the check_settlement_building_tier_match trigger enforces
    -- that currentTierId belongs to buildingBlueprintId.
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
    -- Each entry: buildingId, state, missedUpkeepCount.
    -- deactivated_in_transition_id is derived server-side when state != 'active'.
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

    update public.turn_transitions
    set
      status = 'completed',
      finished_at = now ()
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;

    v_result := jsonb_build_object (
      'transitionId',
      v_transition.id,
      'fromTurnNumber',
      v_transition.from_turn_number,
      'toTurnNumber',
      v_transition.to_turn_number,
      'patchCounts',
      jsonb_build_object (
        'stockpileDeltas',       v_stockpile_delta_count,
        'constructionUpdates',   v_construction_update_count,
        'buildingsCreated',      v_buildings_created_count,
        'buildingStateChanges',  v_building_state_change_count
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
execute on function public.apply_turn_transition (uuid, integer, jsonb)
from
  public;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb) to authenticated;
