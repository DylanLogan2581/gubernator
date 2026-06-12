-- Migration: fix_events_rpcs_search_path
-- create_event_group_with_events and cancel_event_or_group were created with
-- `set search_path = public` (non-empty). The repo standard requires
-- `set search_path = ''` for all SECURITY DEFINER functions to prevent
-- search_path injection attacks. Re-create both functions with the correct
-- setting and fully-qualified helper function calls.
-- ---------------------------------------------------------------------------
create or replace function public.create_event_group_with_events (
  p_world_id uuid,
  p_group_name text,
  p_group_description text,
  p_effect_type text,
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

    -- Create event row
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
      p_effect_type,
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
  end loop;

  -- Return result
  return jsonb_build_object(
    'group_id', v_group_id,
    'event_ids', v_event_ids
  );
end;
$$;

create or replace function public.cancel_event_or_group (p_event_id uuid, p_group_id uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_cancelled_count integer;
begin
  -- Validation: one must be provided
  if p_event_id is null and p_group_id is null then
    raise exception 'Either event_id or group_id must be provided'
    using errcode = '23502';
  end if;

  if p_event_id is not null and p_group_id is not null then
    raise exception 'Only one of event_id or group_id may be provided'
    using errcode = '23514';
  end if;

  -- Get world_id and check permissions
  if p_event_id is not null then
    select world_id
    into v_world_id
    from public.events
    where id = p_event_id;

    if v_world_id is null then
      raise exception 'Event not found'
      using errcode = 'P0002';
    end if;
  else
    select world_id
    into v_world_id
    from public.event_groups
    where id = p_group_id;

    if v_world_id is null then
      raise exception 'Event group not found'
      using errcode = 'P0002';
    end if;
  end if;

  -- Permission check
  if not (public.is_world_admin(v_world_id) or public.is_super_admin()) then
    raise exception 'Not authorized to cancel events in this world'
    using errcode = 'P0001';
  end if;

  -- Cancel events
  if p_event_id is not null then
    update public.events
    set status = 'cancelled'
    where id = p_event_id and status != 'expired'
    returning id into p_event_id;

    v_cancelled_count := coalesce((select count(*)::integer from (select 1 where p_event_id is not null)), 0);
  else
    update public.events
    set status = 'cancelled'
    where event_group_id = p_group_id and status != 'expired';

    v_cancelled_count := found::integer * (select count(*)::integer from public.events where event_group_id = p_group_id);
  end if;

  return jsonb_build_object(
    'cancelled_count', v_cancelled_count
  );
end;
$$;
