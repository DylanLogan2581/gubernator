-- Migration: event_memories_per_turn
-- Replaces the single create_citizen_memories/memory_text pair on public.events
-- with a public.event_memories table: one row per (event, turn_offset), each
-- firing exactly once on its assigned turn instead of the old behaviour of
-- fanning the same text out to every turn the event was in effect.
--
-- Changes:
--   1. New table event_memories (event_id, memory_text, turn_offset), RLS
--      (world-access select, world-admin write — mirrors public.events), and a
--      freeze trigger blocking any write once the parent event leaves 'pending'.
--   2. Backfill: existing events.create_citizen_memories=true rows become a
--      single event_memories row at turn_offset=0, preserving old data.
--   3. Drop events.create_citizen_memories / events.memory_text and the old
--      per-column freeze trigger (replaced by the event_memories trigger).
--   4. citizen_memories gains event_memory_id (nullable, set null on delete);
--      the old (citizen_id, event_id) dedup index is replaced by a
--      (citizen_id, event_memory_id) index, since a citizen can now
--      legitimately receive more than one memory from the same event.
--   5. create_event_group_with_events / update_event_group_with_events gain a
--      trailing p_memories jsonb array param (default '[]'). The legacy
--      p_create_citizen_memories/p_memory_text params are kept (existing call
--      sites keep working unchanged) and now act as a single-memory,
--      turn_offset=0 shorthand used only when p_memories is empty. The update
--      RPC only ever replaces memories for still-pending events in the group —
--      active/expired events' memories are immutable (enforced by the trigger
--      too).
--   6. internal_apply_turn_transition_event_patches now resolves the elapsed
--      turn offset since activation and fires only the event_memories row
--      assigned to that exact offset (idempotent via a unique citizen_memories
--      index keyed on event_memory_id, not event_id).
-- ============================================================================
-- 1. event_memories table
-- ============================================================================
create table public.event_memories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  memory_text text not null,
  turn_offset integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_memories_text_length_check check (char_length(btrim(memory_text)) >= 1),
  constraint event_memories_text_max_length_check check (char_length(memory_text) <= 1000),
  constraint event_memories_turn_offset_nonneg_check check (turn_offset >= 0),
  constraint event_memories_event_turn_offset_unique unique (event_id, turn_offset)
);

create index event_memories_event_id_idx on public.event_memories (event_id);

create trigger event_memories_set_updated_at before
update on public.event_memories for each row
execute function public.set_updated_at ();

alter table public.event_memories enable row level security;

-- SELECT: any user with access to the event's world (mirrors events_select_world_access).
create policy "event_memories_select_world_access" on public.event_memories for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_memories.event_id
        and public.current_user_has_world_access (e.world_id)
    )
  );

-- INSERT/UPDATE/DELETE: world admin or super admin only (writes normally flow
-- through the SECURITY DEFINER RPCs below; no direct-write grant is given to
-- authenticated, matching public.events' "writes via admin RPCs only" model).
create policy "event_memories_insert_world_admin" on public.event_memories for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_memories.event_id
        and (
          public.is_world_admin (e.world_id)
          or public.is_super_admin ()
        )
    )
  );

create policy "event_memories_update_world_admin" on public.event_memories
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_memories.event_id
        and (
          public.is_world_admin (e.world_id)
          or public.is_super_admin ()
        )
    )
  )
with
  check (
    exists (
      select
        1
      from
        public.events e
      where
        e.id = event_memories.event_id
        and (
          public.is_world_admin (e.world_id)
          or public.is_super_admin ()
        )
    )
  );

create policy "event_memories_delete_world_admin" on public.event_memories for delete to authenticated using (
  exists (
    select
      1
    from
      public.events e
    where
      e.id = event_memories.event_id
      and (
        public.is_world_admin (e.world_id)
        or public.is_super_admin ()
      )
  )
);

grant
select
  (
    id,
    event_id,
    memory_text,
    turn_offset,
    created_at,
    updated_at
  ) on public.event_memories to authenticated;

-- ============================================================================
-- 2. Backfill existing single-memory events into event_memories at offset 0
-- ============================================================================
insert into
  public.event_memories (event_id, memory_text, turn_offset)
select
  id,
  btrim(memory_text),
  0
from
  public.events
where
  create_citizen_memories = true
  and memory_text is not null
  and btrim(memory_text) <> '';

-- ============================================================================
-- 3. Drop the old single-memory columns + freeze trigger on events
-- ============================================================================
drop trigger if exists events_freeze_memory_after_activation on public.events;

alter table public.events
drop column create_citizen_memories,
drop column memory_text;

-- ============================================================================
-- 4. citizen_memories: per-memory-row dedup instead of per-event dedup
-- ============================================================================
alter table public.citizen_memories
add column event_memory_id uuid references public.event_memories (id) on delete set null;

create index citizen_memories_event_memory_id_idx on public.citizen_memories (event_memory_id);

drop index if exists public.citizen_memories_event_dedup_idx;

create unique index citizen_memories_event_memory_dedup_idx on public.citizen_memories (citizen_id, event_memory_id)
where
  source = 'event'
  and event_memory_id is not null;

-- Best-effort backfill: link pre-existing event-sourced memories to the
-- offset-0 row just created for their event, so historical rows are covered
-- by the new dedup index too (a no-op for events with no such row).
update public.citizen_memories cm
set
  event_memory_id = em.id
from
  public.event_memories em
where
  cm.source = 'event'
  and cm.event_id = em.event_id
  and em.turn_offset = 0
  and cm.event_memory_id is null;

-- ============================================================================
-- 5. Freeze trigger: block any event_memories write once the parent event has
--    left 'pending'. Reuses the internal_freeze_event_memory_after_activation
--    function name (the old events-table trigger using it was dropped above).
-- ============================================================================
create or replace function public.internal_freeze_event_memory_after_activation () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_event_status text;
begin
  select status
  into v_event_status
  from public.events
  where id = coalesce(new.event_id, old.event_id);

  if v_event_status is distinct from 'pending' then
    raise exception 'Cannot change citizen-memory settings once an event has activated'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger event_memories_freeze_after_activation before insert
or
update
or delete on public.event_memories for each row
execute function public.internal_freeze_event_memory_after_activation ();

-- ============================================================================
-- 6. RPC: create_event_group_with_events — add p_memories, drop single-memory columns
-- Drop the prior 11-arg overload first: adding a trailing parameter changes
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
  text
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
  p_memories jsonb default '[]'::jsonb
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
      multiplier_value
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
      (v_target->>'multiplier_value')::numeric
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
-- 7. RPC: update_event_group_with_events — add p_memories, drop single-memory columns
-- Same reasoning as above: drop the prior 9-arg overload before recreating.
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
  text
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
  p_memories jsonb default '[]'::jsonb
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
    activate_on_transition_after_turn_number = p_activate_on_transition_after_turn_number
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

-- ============================================================================
-- 8. internal_apply_turn_transition_event_patches — fire the memory assigned
--    to the exact elapsed turn offset, not the same text every turn.
-- ============================================================================
create or replace function public.internal_apply_turn_transition_event_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_to_turn_number integer,
  p_payload jsonb,
  out event_status_update_count integer,
  out citizen_memory_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_patch jsonb;
  v_event_id uuid;
  v_to_status text;
  v_from_status text;
  v_remaining_transitions integer;
  v_duration_type text;
  v_duration_transitions integer;
  v_turn_offset integer;
  v_scope_type text;
  v_scope_nation_id uuid;
  v_scope_settlement_id uuid;
  v_memory_id uuid;
  v_memory_text text;
  v_inserted_count integer;
begin
  event_status_update_count := 0;
  citizen_memory_count      := 0;

  for v_patch in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'eventStatusPatches', '[]'::jsonb))
  loop
    v_event_id             := (v_patch ->> 'eventId')::uuid;
    v_to_status            := v_patch ->> 'toStatus';
    v_from_status          := v_patch ->> 'fromStatus';
    v_remaining_transitions := (v_patch ->> 'remainingTransitions')::integer;

    -- Apply the status + remaining_transitions update
    update public.events
    set
      status                 = v_to_status,
      remaining_transitions  = v_remaining_transitions
    where id = v_event_id
      and world_id = p_world_id;

    event_status_update_count := event_status_update_count + 1;

    select
      e.duration_type,
      e.duration_transitions,
      e.scope_type,
      e.scope_nation_id,
      e.scope_settlement_id
    into
      v_duration_type,
      v_duration_transitions,
      v_scope_type,
      v_scope_nation_id,
      v_scope_settlement_id
    from public.events e
    where e.id = v_event_id;

    if not found then
      continue;
    end if;

    -- Turns elapsed since first activation: 0 on the turn the event first
    -- activates, incrementing by 1 each subsequent turn it stays active.
    v_turn_offset := case
      when v_duration_type = 'instant' then 0
      else coalesce(v_duration_transitions, 1) - coalesce(v_remaining_transitions, 0) - 1
    end;

    select em.id, em.memory_text
    into v_memory_id, v_memory_text
    from public.event_memories em
    where em.event_id = v_event_id
      and em.turn_offset = v_turn_offset;

    -- Defensive: never let a blank memory_text abort the turn transition.
    if found
      and v_memory_text is not null
      and btrim(v_memory_text) <> '' then
      if v_scope_type = 'settlement' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          event_memory_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          v_memory_id,
          p_to_turn_number
        from public.citizens c
        where c.settlement_id = v_scope_settlement_id
          and c.status = 'alive'
        on conflict do nothing;

      elsif v_scope_type = 'nation' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          event_memory_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          v_memory_id,
          p_to_turn_number
        from public.citizens c
        join public.settlements s on s.id = c.settlement_id
        where s.nation_id = v_scope_nation_id
          and c.status = 'alive'
        on conflict do nothing;

      elsif v_scope_type = 'world' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          event_memory_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          v_memory_id,
          p_to_turn_number
        from public.citizens c
        where c.world_id = p_world_id
          and c.status = 'alive'
        on conflict do nothing;
      end if;

      get diagnostics v_inserted_count = row_count;
      citizen_memory_count := citizen_memory_count + v_inserted_count;

      -- Only log turns that actually created memories (avoids a 0-count log
      -- entry every turn for the lifetime of a sustained event).
      if v_inserted_count > 0 then
        insert into public.turn_log_entries (
          turn_transition_id,
          world_id,
          log_category,
          payload_jsonb
        ) values (
          p_transition_id,
          p_world_id,
          'event_memories',
          jsonb_build_object(
            'eventId', v_event_id::text,
            'count',   v_inserted_count
          )
        );
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb) to service_role;
