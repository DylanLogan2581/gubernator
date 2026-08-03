-- Migration: apply_turn_transition_building_tier_upgrades
-- #1372: extends internal_apply_turn_transition_construction_patches (the helper
-- that apply_turn_transition delegates construction/building writes to) to
-- consume a new buildingTierUpgrades payload key, bumping
-- settlement_buildings.current_tier_id in place when an upgrade project
-- completes (no new building row). Copied verbatim from the latest prior
-- definition (20260619000001) with only the §C29d loop added; the OUT-parameter
-- signature is unchanged so existing grants and the apply_turn_transition caller
-- keep working.
-- ---------------------------------------------------------------------------
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

  -- §C29d (#1372): Apply building tier upgrades. Each entry: buildingId,
  -- currentTierId. Bumps the existing building's tier in place (no new row);
  -- counted under buildings_created_count is intentionally avoided — the
  -- check_settlement_building_tier_match trigger enforces tier↔blueprint
  -- consistency.
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'buildingTierUpgrades', '[]'::jsonb))
  loop
    v_building_id := (v_update ->> 'buildingId')::uuid;
    v_tier_id     := (v_update ->> 'currentTierId')::uuid;

    update public.settlement_buildings
    set
      current_tier_id = v_tier_id
    where
      id = v_building_id;
  end loop;
end;
$$;
