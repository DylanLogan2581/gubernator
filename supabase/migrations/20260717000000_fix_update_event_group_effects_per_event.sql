-- Migration: fix_update_event_group_effects_per_event
-- Fixes two bugs in update_event_group_with_events:
-- 1. Effects were attached only to the first event in the group (limit 1 inner
--    query) instead of every non-expired event. In multi-target groups only one
--    target kept effects after an edit.
-- 2. remaining_transitions was reset to the full new duration for all non-expired
--    events, including already-active ones. Editing a group silently refilled
--    the in-flight countdown on active sustained events.
--
-- Fix: mirror the create RPC's per-event outer loop for effect insertion, and
-- preserve remaining_transitions on non-pending (already-active) events.
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
