-- pgTAP tests for issue #1025 acceptance criterion:
-- "Two memories on different turns of a sustained event are recorded on
-- their assigned turns only."
--
-- Mirrors the issue's forecast example: a world-scoped, sustained (2-turn)
-- event with one memory pinned to turn_offset=0 and another to turn_offset=1.
-- Verifies each memory fires only on its own assigned turn, never early and
-- never re-fired on the other turn.
--
-- Runs inside a transaction that is rolled back; leaves no permanent data.
begin;

select
  plan (5);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures
-- ─────────────────────────────────────────────────────────────────────────────
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'ed100000-0000-0000-0000-000000000001',
    'evoffset-owner@example.com',
    'x',
    now(),
    '{"username":"evoffset_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'ed200000-0000-0000-0000-000000000001',
    'Event Offset World',
    'private',
    'active',
    10
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ed200000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ed300000-0000-0000-0000-000000000001',
    'ed200000-0000-0000-0000-000000000001',
    'Nation Offset'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ed400000-0000-0000-0000-000000000001',
    'ed300000-0000-0000-0000-000000000001',
    'Settlement Offset'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause_category
  )
values
  (
    'ed500000-0000-0000-0000-000000000001',
    'ed200000-0000-0000-0000-000000000001',
    'ed400000-0000-0000-0000-000000000001',
    'npc',
    'Ada',
    'alive',
    null
  ),
  (
    'ed500000-0000-0000-0000-000000000002',
    'ed200000-0000-0000-0000-000000000001',
    'ed400000-0000-0000-0000-000000000001',
    'npc',
    'Bea',
    'alive',
    null
  );

insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'ed600000-0000-0000-0000-000000000001',
    'ed200000-0000-0000-0000-000000000001',
    'Offset Group',
    10
  );

-- World-scoped, sustained, 2-turn event: pending, about to fire turn 1.
insert into
  public.events (
    id,
    world_id,
    event_group_id,
    name,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    duration_type,
    duration_transitions,
    remaining_transitions
  )
values
  (
    'ed700000-0000-0000-0000-000000000001',
    'ed200000-0000-0000-0000-000000000001',
    'ed600000-0000-0000-0000-000000000001',
    'Two-Turn Event',
    'pending',
    'population_loss',
    9,
    'world',
    'sustained',
    2,
    2
  );

-- Two memories, one per turn of the event's 2-turn duration.
insert into
  public.event_memories (id, event_id, memory_text, turn_offset)
values
  (
    'ed800000-0000-0000-0000-000000000001',
    'ed700000-0000-0000-0000-000000000001',
    'Turn 1 memory',
    0
  ),
  (
    'ed800000-0000-0000-0000-000000000002',
    'ed700000-0000-0000-0000-000000000001',
    'Turn 2 memory',
    1
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    initiated_by_user_id,
    status,
    from_turn_number,
    to_turn_number
  )
values
  (
    'ed900000-0000-0000-0000-000000000001',
    'ed200000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001',
    'running',
    10,
    11
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Turn 1: pending → active, remainingTransitions=1
-- (duration_transitions(2) - remaining_transitions(1) - 1 = offset 0)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_payload jsonb := jsonb_build_object(
    'eventStatusPatches',
    jsonb_build_array(
      jsonb_build_object('eventId', 'ed700000-0000-0000-0000-000000000001',
                         'fromStatus', 'pending', 'toStatus', 'active',
                         'remainingTransitions', 1)
    )
  );
begin
  perform public.internal_apply_turn_transition_event_patches(
    'ed200000-0000-0000-0000-000000000001'::uuid,
    'ed900000-0000-0000-0000-000000000001'::uuid,
    11,
    v_payload
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 1: after turn 1, both citizens received the turn-1 memory only
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_memory_id = 'ed800000-0000-0000-0000-000000000001'
    ),
    2,
    'turn-1 memory fires for both alive citizens on turn 1'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 2: the turn-2 memory has NOT fired yet
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_memory_id = 'ed800000-0000-0000-0000-000000000002'
    ),
    0,
    'turn-2 memory does not fire early, on turn 1'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Turn 2: active → expired, remainingTransitions=0
-- (duration_transitions(2) - remaining_transitions(0) - 1 = offset 1)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_payload jsonb := jsonb_build_object(
    'eventStatusPatches',
    jsonb_build_array(
      jsonb_build_object('eventId', 'ed700000-0000-0000-0000-000000000001',
                         'fromStatus', 'active', 'toStatus', 'expired',
                         'remainingTransitions', 0)
    )
  );
begin
  perform public.internal_apply_turn_transition_event_patches(
    'ed200000-0000-0000-0000-000000000001'::uuid,
    'ed900000-0000-0000-0000-000000000001'::uuid,
    12,
    v_payload
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 3: after turn 2, the turn-2 memory has now fired for both citizens
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_memory_id = 'ed800000-0000-0000-0000-000000000002'
    ),
    2,
    'turn-2 memory fires for both alive citizens on turn 2'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 4: the turn-1 memory count is unchanged — it does not re-fire on turn 2
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_memory_id = 'ed800000-0000-0000-0000-000000000001'
    ),
    2,
    'turn-1 memory does not re-fire on turn 2'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 5: each citizen ends up with exactly 2 memories total — one per turn,
-- never both on the same turn
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        citizen_id = 'ed500000-0000-0000-0000-000000000001'
        and event_id = 'ed700000-0000-0000-0000-000000000001'
    ),
    2,
    'a single citizen accumulates exactly one memory per assigned turn'
  );

select
  *
from
  finish ();

rollback;
