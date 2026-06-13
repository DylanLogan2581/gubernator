-- Migration: update_event_creation_rpc_for_effects
-- Purpose: Update create_event_group_with_events RPC to handle multiple effects
-- via the event_effects table instead of a single effect_type.
-- ============================================================================
-- RPC: create_event_group_with_events (updated)
-- ============================================================================
-- Creates one event_group row and one event row per target atomically,
-- and inserts effects into the event_effects table.
--
-- Parameters:
--   p_world_id: UUID of the world
--   p_group_name: narrative name for the group
--   p_group_description: optional description
--   p_effects: JSON array of effect objects
--     Format: [
--       {
--         "effect_type": "resource_grant" | "resource_drain" | ... (10 types),
--         "is_percent": boolean,
--         "amount_value": numeric or null,
--         "multiplier_value": numeric or null,
--         "resource_id": uuid or null,
--         "job_id": uuid or null,
--         "managed_population_instance_id": uuid or null,
--         "deposit_instance_id": uuid or null
--       }
--     ]
--   p_scope_type: 'world' | 'nation' | 'settlement'
--   p_targets: JSON array of target objects
--   p_duration_type: 'instant' | 'sustained'
--   p_duration_transitions: integer (required if sustained, ignored if instant)
--   p_activate_on_transition_after_turn_number: integer
--   p_create_citizen_memories: boolean
--   p_memory_text: text or null
--
-- Returns: JSON with created group_id and event_ids
create or replace function public.create_event_group_with_events (
  p_world_id uuid,
  p_group_name text,
  p_group_description text,
  p_effects jsonb,
  p_scope_type text,
  p_targets jsonb,
  p_duration_type text,
  p_duration_transitions integer,
  p_activate_on_transition_after_turn_number integer,
  p_create_citizen_memories boolean,
  p_memory_text text
) returns jsonb language plpgsql security definer
set
  search_path = public as $$
declare
  v_group_id uuid;
  v_event_ids uuid[];
  v_target jsonb;
  v_scope_nation_id uuid;
  v_scope_settlement_id uuid;
  v_current_turn_number integer;
  v_event_id uuid;
  v_effect jsonb;
begin
  -- Permission check: caller must be world admin or superadmin
  if not (is_world_admin(p_world_id) or is_super_admin()) then
    raise exception 'Not authorized to create events in this world'
    using errcode = 'P0001';
  end if;

  -- Input validation
  if p_group_name is null or btrim(p_group_name) = '' then
    raise exception 'Event group name is required'
    using errcode = '23502';
  end if;

  if char_length(btrim(p_group_name)) > 128 then
    raise exception 'Event group name exceeds maximum length'
    using errcode = '23514';
  end if;

  if p_group_description is not null and char_length(p_group_description) > 1000 then
    raise exception 'Event group description exceeds maximum length'
    using errcode = '23514';
  end if;

  if p_effects is null or jsonb_array_length(p_effects) = 0 then
    raise exception 'At least one effect is required'
    using errcode = '23502';
  end if;

  if p_duration_type = 'sustained' and (p_duration_transitions is null or p_duration_transitions <= 0) then
    raise exception 'Duration transitions required and must be > 0 for sustained events'
    using errcode = '23502';
  end if;

  if not p_scope_type = any(array['world', 'nation', 'settlement']) then
    raise exception 'Invalid scope_type'
    using errcode = '23514';
  end if;

  -- Get current turn number for remaining_transitions
  select current_turn_number
  into v_current_turn_number
  from public.worlds
  where id = p_world_id;

  if v_current_turn_number is null then
    raise exception 'World not found'
    using errcode = 'P0002';
  end if;

  -- Create event group
  insert into public.event_groups (world_id, name, description, created_during_turn_number, created_by_user_id)
  values (p_world_id, btrim(p_group_name), p_group_description, v_current_turn_number, auth.uid())
  returning id into v_group_id;

  -- Create one event per target
  for v_target in select jsonb_array_elements(p_targets)
  loop
    -- Determine scope IDs based on scope_type
    if p_scope_type = 'world' then
      v_scope_nation_id := null;
      v_scope_settlement_id := null;
    elsif p_scope_type = 'nation' then
      v_scope_nation_id := (v_target->>'scope_id')::uuid;
      v_scope_settlement_id := null;
    elsif p_scope_type = 'settlement' then
      v_scope_nation_id := null;
      v_scope_settlement_id := (v_target->>'scope_id')::uuid;
    end if;

    -- Create event row (with effect_type set to first effect's type for backward compat)
    insert into public.events (
      world_id,
      event_group_id,
      name,
      description,
      status,
      effect_type,
      effect_payload_jsonb,
      activate_on_transition_after_turn_number,
      scope_type,
      scope_nation_id,
      scope_settlement_id,
      duration_type,
      duration_transitions,
      remaining_transitions,
      job_id,
      building_blueprint_id,
      managed_population_type_id,
      amount_value,
      multiplier_value,
      create_citizen_memories,
      memory_text
    ) values (
      p_world_id,
      v_group_id,
      (v_target->>'scope_name')::text,
      null,
      'pending',
      (p_effects->0->>'effect_type')::text,
      '{}'::jsonb,
      p_activate_on_transition_after_turn_number,
      p_scope_type,
      v_scope_nation_id,
      v_scope_settlement_id,
      p_duration_type,
      case when p_duration_type = 'sustained' then p_duration_transitions else null end,
      case when p_duration_type = 'sustained' then p_duration_transitions else null end,
      (v_target->>'job_id')::bigint,
      (v_target->>'building_blueprint_id')::uuid,
      (v_target->>'managed_population_type_id')::uuid,
      (v_target->>'amount_value')::numeric,
      (v_target->>'multiplier_value')::numeric,
      p_create_citizen_memories,
      p_memory_text
    )
    returning id into v_event_id;

    v_event_ids := array_append(v_event_ids, v_event_id);

    -- Insert effects for this event
    for v_effect in select jsonb_array_elements(p_effects)
    loop
      insert into public.event_effects (
        event_id,
        effect_type,
        amount_value,
        multiplier_value,
        is_percent,
        resource_id,
        job_id,
        managed_population_instance_id,
        deposit_instance_id,
        settlement_building_id
      ) values (
        v_event_id,
        (v_effect->>'effect_type')::text,
        (v_effect->>'amount_value')::numeric,
        (v_effect->>'multiplier_value')::numeric,
        coalesce((v_effect->>'is_percent')::boolean, false),
        (v_effect->>'resource_id')::uuid,
        (v_effect->>'job_id')::uuid,
        (v_effect->>'managed_population_instance_id')::uuid,
        (v_effect->>'deposit_instance_id')::uuid,
        (v_effect->>'settlement_building_id')::uuid
      );
    end loop;
  end loop;

  -- Return result
  return jsonb_build_object(
    'group_id', v_group_id,
    'event_ids', v_event_ids
  );
end;
$$;
