-- Migration: add_per_effect_validation_to_rpcs
-- Purpose: Enforce per-effect required-field rules inside the database so that
-- direct RPC callers cannot bypass the JS-layer validation that previously
-- lived only in validateEffectFields (now moved to the Zod schema).
--
-- Changes:
--   1. New helper: public.validate_event_effect_fields(p_effect jsonb)
--      Raises an exception when a required field for the given effect type is
--      absent or zero.  Called from both write RPCs below.
--   2. Re-creates create_event_group_with_events to call the helper before
--      inserting into event_effects.
--   3. Re-creates update_event_group_with_events to call the helper before
--      inserting into event_effects.
-- ============================================================================
-- Helper: per-effect required-field validation
-- ============================================================================
create or replace function public.validate_event_effect_fields (p_effect jsonb) returns void language plpgsql
set
  search_path = '' as $$
declare
  v_effect_type text;
begin
  v_effect_type := p_effect->>'effect_type';

  -- Amount-based types: require a non-zero amount_value
  if v_effect_type = any(array[
    'population_boost', 'population_loss', 'managed_population_change',
    'resource_grant', 'resource_drain'
  ]) then
    if (p_effect->>'amount_value') is null
       or (p_effect->>'amount_value')::numeric = 0 then
      raise exception 'Effect type % requires a non-zero amount', v_effect_type
        using errcode = '22023';
    end if;
  end if;

  -- Multiplier types: require a non-zero multiplier_value
  if v_effect_type = any(array[
    'consumption_multiplier', 'production_multiplier', 'upkeep_multiplier'
  ]) then
    if (p_effect->>'multiplier_value') is null
       or (p_effect->>'multiplier_value')::numeric = 0 then
      raise exception 'Effect type % requires a non-zero multiplier', v_effect_type
        using errcode = '22023';
    end if;
  end if;

  -- Resource effects: require resource_id
  if v_effect_type = any(array['resource_grant', 'resource_drain']) then
    if (p_effect->>'resource_id') is null then
      raise exception 'Effect type % requires a resource selection', v_effect_type
        using errcode = '22023';
    end if;
  end if;

  -- deposit_destroyed: require deposit_instance_id
  if v_effect_type = 'deposit_destroyed' then
    if (p_effect->>'deposit_instance_id') is null then
      raise exception 'Effect type deposit_destroyed requires a deposit selection'
        using errcode = '22023';
    end if;
  end if;

  -- building_destroyed: require settlement_building_id
  if v_effect_type = 'building_destroyed' then
    if (p_effect->>'settlement_building_id') is null then
      raise exception 'Effect type building_destroyed requires a building selection'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

-- RPC: create_event_group_with_events (updated — adds per-effect validation)
-- ============================================================================
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
  search_path = '' as $$
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
  if not (public.is_world_admin(p_world_id) or public.is_super_admin()) then
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

  if p_effects is null then
    raise exception 'Effects array is required (can be empty)'
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

  -- Validate per-effect required fields (empty array is allowed for narrative-only events)
  for v_effect in select jsonb_array_elements(p_effects)
  loop
    perform public.validate_event_effect_fields(v_effect);
  end loop;

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
      case
        when (p_effects->0->>'effect_type')::text = 'managed_population_change' then
          jsonb_build_object(
            'delta', (p_effects->0->>'amount_value')::numeric,
            'managed_population_id', (p_effects->0->>'managed_population_instance_id')::text,
            'managed_population_type_id', (p_effects->0->>'managed_population_type_id')::text,
            'managed_population_mode', (p_effects->0->'extra_data_jsonb'->>'managed_population_mode')::text
          )
        else '{}' :: jsonb
      end,
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
        managed_population_type_id,
        deposit_instance_id,
        settlement_building_id,
        extra_data_jsonb
      ) values (
        v_event_id,
        (v_effect->>'effect_type')::text,
        (v_effect->>'amount_value')::numeric,
        (v_effect->>'multiplier_value')::numeric,
        coalesce((v_effect->>'is_percent')::boolean, false),
        (v_effect->>'resource_id')::uuid,
        (v_effect->>'job_id')::uuid,
        (v_effect->>'managed_population_instance_id')::uuid,
        (v_effect->>'managed_population_type_id')::uuid,
        (v_effect->>'deposit_instance_id')::uuid,
        (v_effect->>'settlement_building_id')::uuid,
        coalesce((v_effect->>'extra_data_jsonb')::jsonb, '{}' :: jsonb)
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

-- RPC: update_event_group_with_events (updated — adds per-effect validation)
-- ============================================================================
create or replace function public.update_event_group_with_events (
  p_group_id uuid,
  p_group_name text,
  p_group_description text,
  p_effects jsonb,
  p_duration_type text,
  p_duration_transitions integer,
  p_activate_on_transition_after_turn_number integer,
  p_create_citizen_memories boolean,
  p_memory_text text
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_current_turn_number integer;
  v_effect jsonb;
  v_event_id uuid;
begin
  -- Get world_id and check permissions
  select world_id
  into v_world_id
  from public.event_groups
  where id = p_group_id;

  if v_world_id is null then
    raise exception 'Event group not found'
    using errcode = 'P0002';
  end if;

  -- Permission check: caller must be world admin or superadmin
  if not (public.is_world_admin(v_world_id) or public.is_super_admin()) then
    raise exception 'Not authorized to edit events in this world'
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

  if p_duration_type = 'sustained' and (p_duration_transitions is null or p_duration_transitions <= 0) then
    raise exception 'Duration transitions required and must be > 0 for sustained events'
    using errcode = '23502';
  end if;

  if not p_duration_type = any(array['instant', 'sustained']) then
    raise exception 'Invalid duration_type'
    using errcode = '23514';
  end if;

  -- Validate per-effect required fields (empty array is allowed for narrative-only events)
  for v_effect in select jsonb_array_elements(p_effects)
  loop
    perform public.validate_event_effect_fields(v_effect);
  end loop;

  -- Get current turn number
  select current_turn_number
  into v_current_turn_number
  from public.worlds
  where id = v_world_id;

  if v_current_turn_number is null then
    raise exception 'World not found'
    using errcode = 'P0002';
  end if;

  -- Update event group metadata
  update public.event_groups
  set
    name = btrim(p_group_name),
    description = p_group_description,
    updated_at = now()
  where id = p_group_id;

  -- Update all non-expired events with new duration and activation settings.
  -- Active events keep their current remaining_transitions to preserve the
  -- in-flight countdown; only pending events get the countdown reset to the
  -- new full duration.
  update public.events
  set
    duration_type = p_duration_type,
    duration_transitions = case when p_duration_type = 'sustained' then p_duration_transitions else null end,
    remaining_transitions = case
      when p_duration_type != 'sustained' then null
      when status = 'pending' then p_duration_transitions
      else remaining_transitions
    end,
    activate_on_transition_after_turn_number = p_activate_on_transition_after_turn_number,
    create_citizen_memories = p_create_citizen_memories,
    memory_text = p_memory_text
  where event_group_id = p_group_id and status != 'expired';

  -- Delete all existing event_effects for this group's events
  delete from public.event_effects
  where event_id in (
    select id from public.events where event_group_id = p_group_id
  );

  -- Insert new effects per non-expired event, mirroring the create RPC per-target loop
  for v_event_id in
    select id from public.events
    where event_group_id = p_group_id and status != 'expired'
  loop
    for v_effect in select jsonb_array_elements(p_effects)
    loop
      insert into public.event_effects (
        event_id,
        effect_type,
        is_percent,
        amount_value,
        multiplier_value,
        resource_id,
        job_id,
        managed_population_instance_id,
        managed_population_type_id,
        deposit_instance_id,
        settlement_building_id,
        extra_data_jsonb
      ) values (
        v_event_id,
        v_effect->>'effect_type',
        coalesce((v_effect->>'is_percent')::boolean, false),
        case when v_effect->>'amount_value' is not null then (v_effect->>'amount_value')::numeric else null end,
        case when v_effect->>'multiplier_value' is not null then (v_effect->>'multiplier_value')::numeric else null end,
        case when v_effect->>'resource_id' is not null then (v_effect->>'resource_id')::uuid else null end,
        case when v_effect->>'job_id' is not null then (v_effect->>'job_id')::uuid else null end,
        case when v_effect->>'managed_population_instance_id' is not null then (v_effect->>'managed_population_instance_id')::uuid else null end,
        case when v_effect->>'managed_population_type_id' is not null then (v_effect->>'managed_population_type_id')::uuid else null end,
        case when v_effect->>'deposit_instance_id' is not null then (v_effect->>'deposit_instance_id')::uuid else null end,
        case when v_effect->>'settlement_building_id' is not null then (v_effect->>'settlement_building_id')::uuid else null end,
        case when v_effect->'extra_data_jsonb' is not null then v_effect->'extra_data_jsonb' else '{}'::jsonb end
      );
    end loop;
  end loop;

  return jsonb_build_object('group_id', p_group_id);
end;
$$;
