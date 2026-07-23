-- Migration: add_icon_to_events
-- Adds a nullable `icon` text column (a curated Lucide icon name, see
-- src/components/shared/iconPicker/CuratedIcons.ts) to public.events so
-- every event surface can render a per-event icon instead of the fixed
-- domain Zap icon. RLS is unchanged: existing events policies already cover
-- this column. create_event_group_with_events / update_event_group_with_events
-- gain a trailing p_icon param (default null) to set it on create/edit.
-- ============================================================================
alter table public.events
add column icon text null;

alter table public.events
add constraint events_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
);

-- ============================================================================
-- create_event_group_with_events: add trailing p_icon param.
-- Drop the prior 12-arg overload first: adding a trailing parameter changes
-- the signature, so CREATE OR REPLACE would otherwise leave both overloads
-- in place and every call site with named/positional args would become
-- ambiguous (42725).
-- ============================================================================
drop function if exists public.create_event_group_with_events (
  uuid,
  text,
  text,
  jsonb,
  text,
  jsonb,
  text,
  integer,
  integer,
  boolean,
  text,
  jsonb
);

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
  p_memory_text text,
  p_memories jsonb default '[]'::jsonb,
  p_icon text default null
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
  v_memories jsonb;
  v_memory jsonb;
  v_max_turn_offset integer;
  v_memory_text text;
  v_turn_offset integer;
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

  if p_icon is not null and char_length(p_icon) > 64 then
    raise exception 'Icon name exceeds maximum length'
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

  -- Validate per-effect required fields and same-world references (empty
  -- array is allowed for narrative-only events)
  for v_effect in select jsonb_array_elements(p_effects)
  loop
    perform public.validate_event_effect_fields(v_effect);
    perform public.validate_event_effect_world_membership(p_world_id, v_effect);
  end loop;

  -- Resolve the memories to insert: the new per-turn array when supplied,
  -- otherwise the legacy single create_citizen_memories/memory_text pair as a
  -- turn_offset=0 shorthand.
  if jsonb_array_length(coalesce(p_memories, '[]'::jsonb)) > 0 then
    v_memories := p_memories;
  elsif p_create_citizen_memories and p_memory_text is not null and btrim(p_memory_text) <> '' then
    v_memories := jsonb_build_array(jsonb_build_object('memory_text', p_memory_text, 'turn_offset', 0));
  else
    v_memories := '[]'::jsonb;
  end if;

  v_max_turn_offset := case when p_duration_type = 'sustained' then p_duration_transitions else 1 end;

  for v_memory in select jsonb_array_elements(v_memories)
  loop
    v_memory_text := v_memory ->> 'memory_text';
    v_turn_offset := (v_memory ->> 'turn_offset')::integer;

    if v_memory_text is null or btrim(v_memory_text) = '' then
      raise exception 'Memory text is required for every memory entry'
      using errcode = '23502';
    end if;

    if char_length(v_memory_text) > 1000 then
      raise exception 'Memory text exceeds maximum length'
      using errcode = '23514';
    end if;

    if v_turn_offset is null or v_turn_offset < 0 or v_turn_offset >= v_max_turn_offset then
      raise exception 'Memory turn offset % is out of range for this event''s duration', v_turn_offset
      using errcode = '23514';
    end if;
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
      icon
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
      p_icon
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

    -- Insert per-turn memories for this event
    for v_memory in select jsonb_array_elements(v_memories)
    loop
      insert into public.event_memories (event_id, memory_text, turn_offset)
      values (
        v_event_id,
        btrim(v_memory ->> 'memory_text'),
        (v_memory ->> 'turn_offset')::integer
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

-- ============================================================================
-- update_event_group_with_events: add trailing p_icon param.
-- Same reasoning as above: drop the prior 10-arg overload before recreating.
-- ============================================================================
drop function if exists public.update_event_group_with_events (
  uuid,
  text,
  text,
  jsonb,
  text,
  integer,
  integer,
  boolean,
  text,
  jsonb
);

create or replace function public.update_event_group_with_events (
  p_group_id uuid,
  p_group_name text,
  p_group_description text,
  p_effects jsonb,
  p_duration_type text,
  p_duration_transitions integer,
  p_activate_on_transition_after_turn_number integer,
  p_create_citizen_memories boolean,
  p_memory_text text,
  p_memories jsonb default '[]'::jsonb,
  p_icon text default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_current_turn_number integer;
  v_effect jsonb;
  v_event_id uuid;
  v_memories jsonb;
  v_memory jsonb;
  v_max_turn_offset integer;
  v_memory_text text;
  v_turn_offset integer;
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

  perform public.assert_world_not_archived(v_world_id);

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

  if p_icon is not null and char_length(p_icon) > 64 then
    raise exception 'Icon name exceeds maximum length'
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

  -- Validate per-effect required fields and same-world references
  for v_effect in select jsonb_array_elements(p_effects)
  loop
    perform public.validate_event_effect_fields(v_effect);
    perform public.validate_event_effect_world_membership(v_world_id, v_effect);
  end loop;

  -- Resolve the memories to (re)insert, same shorthand rules as the create RPC.
  if jsonb_array_length(coalesce(p_memories, '[]'::jsonb)) > 0 then
    v_memories := p_memories;
  elsif p_create_citizen_memories and p_memory_text is not null and btrim(p_memory_text) <> '' then
    v_memories := jsonb_build_array(jsonb_build_object('memory_text', p_memory_text, 'turn_offset', 0));
  else
    v_memories := '[]'::jsonb;
  end if;

  v_max_turn_offset := case when p_duration_type = 'sustained' then p_duration_transitions else 1 end;

  for v_memory in select jsonb_array_elements(v_memories)
  loop
    v_memory_text := v_memory ->> 'memory_text';
    v_turn_offset := (v_memory ->> 'turn_offset')::integer;

    if v_memory_text is null or btrim(v_memory_text) = '' then
      raise exception 'Memory text is required for every memory entry'
      using errcode = '23502';
    end if;

    if char_length(v_memory_text) > 1000 then
      raise exception 'Memory text exceeds maximum length'
      using errcode = '23514';
    end if;

    if v_turn_offset is null or v_turn_offset < 0 or v_turn_offset >= v_max_turn_offset then
      raise exception 'Memory turn offset % is out of range for this event''s duration', v_turn_offset
      using errcode = '23514';
    end if;
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

  -- Update all non-expired events with new duration, activation, and icon
  -- settings. Active events keep their current remaining_transitions to
  -- preserve the in-flight countdown; only pending events get the countdown
  -- reset to the new full duration.
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
    icon = p_icon
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

  -- Replace memories only for events that have not yet activated. Once an
  -- event leaves 'pending' its memories are frozen (the event_memories
  -- freeze trigger would reject these writes anyway); skipping them here
  -- avoids re-creating rows for memories that may have already fired,
  -- which would break the citizen_memories dedup index.
  delete from public.event_memories
  where event_id in (
    select id from public.events where event_group_id = p_group_id and status = 'pending'
  );

  for v_event_id in
    select id from public.events
    where event_group_id = p_group_id and status = 'pending'
  loop
    for v_memory in select jsonb_array_elements(v_memories)
    loop
      insert into public.event_memories (event_id, memory_text, turn_offset)
      values (
        v_event_id,
        btrim(v_memory ->> 'memory_text'),
        (v_memory ->> 'turn_offset')::integer
      );
    end loop;
  end loop;

  return jsonb_build_object('group_id', p_group_id);
end;
$$;
