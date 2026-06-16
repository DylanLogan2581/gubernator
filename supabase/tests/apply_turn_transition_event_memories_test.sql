-- pgTAP tests for citizen memory auto-generation via apply_turn_transition.
-- Covers:
--   1. Settlement-scoped event → only citizens of that settlement get memories
--   2. Nation-scoped event    → citizens of all settlements in that nation get memories
--   3. World-scoped event     → all alive citizens in the world get memories
--   4. Dead citizens excluded (citizens schema only supports alive/dead)
--   5. create_citizen_memories = false → zero memories
--   6. Active (non-first) turn of a sustained event → memories still fire
--   7. Re-firing the same event does not duplicate existing memories
--   8. A citizen newly in scope on a later turn receives the memory
--
-- Runs inside a transaction that is rolled back; leaves no permanent data.
begin;

select
  plan (8);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures
-- ─────────────────────────────────────────────────────────────────────────────
-- Users
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
    'ec100000-0000-0000-0000-000000000001',
    'evmem-owner@example.com',
    'x',
    now(),
    '{"username":"evmem_owner"}'::jsonb,
    now(),
    now()
  );

-- World
insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'ec200000-0000-0000-0000-000000000001',
    'Event Memories World',
    'private',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ec200000-0000-0000-0000-000000000001',
    'ec100000-0000-0000-0000-000000000001'
  );

-- Nations
insert into
  public.nations (id, world_id, name)
values
  (
    'ec300000-0000-0000-0000-000000000001',
    'ec200000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'ec300000-0000-0000-0000-000000000002',
    'ec200000-0000-0000-0000-000000000001',
    'Nation B'
  );

-- Settlements
-- nation A: two settlements
-- nation B: one settlement
insert into
  public.settlements (id, nation_id, name)
values
  (
    'ec400000-0000-0000-0000-000000000001',
    'ec300000-0000-0000-0000-000000000001',
    'Settlement A1'
  ),
  (
    'ec400000-0000-0000-0000-000000000002',
    'ec300000-0000-0000-0000-000000000001',
    'Settlement A2'
  ),
  (
    'ec400000-0000-0000-0000-000000000003',
    'ec300000-0000-0000-0000-000000000002',
    'Settlement B1'
  );

-- Citizens
-- settlement A1: 2 alive, 1 dead
-- settlement A2: 1 alive
-- settlement B1: 1 alive
-- (citizens schema only supports status 'alive'/'dead'; no pending status)
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
  -- A1 alive
  (
    'ec500000-0000-0000-0000-000000000001',
    'ec200000-0000-0000-0000-000000000001',
    'ec400000-0000-0000-0000-000000000001',
    'npc',
    'Alice',
    'alive',
    null
  ),
  (
    'ec500000-0000-0000-0000-000000000002',
    'ec200000-0000-0000-0000-000000000001',
    'ec400000-0000-0000-0000-000000000001',
    'npc',
    'Bob',
    'alive',
    null
  ),
  -- A1 dead (must not get a memory)
  (
    'ec500000-0000-0000-0000-000000000003',
    'ec200000-0000-0000-0000-000000000001',
    'ec400000-0000-0000-0000-000000000001',
    'npc',
    'DeadDan',
    'dead',
    'unknown'
  ),
  -- A2 alive
  (
    'ec500000-0000-0000-0000-000000000004',
    'ec200000-0000-0000-0000-000000000001',
    'ec400000-0000-0000-0000-000000000002',
    'npc',
    'Carol',
    'alive',
    null
  ),
  -- B1 alive
  (
    'ec500000-0000-0000-0000-000000000005',
    'ec200000-0000-0000-0000-000000000001',
    'ec400000-0000-0000-0000-000000000003',
    'npc',
    'Dave',
    'alive',
    null
  );

-- Event groups (placeholder; referenced by events FK)
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'ec600000-0000-0000-0000-000000000001',
    'ec200000-0000-0000-0000-000000000001',
    'Test Group',
    5
  );

-- Events
-- Event 1: settlement-scoped, create_citizen_memories=true, pending
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
    scope_settlement_id,
    duration_type,
    create_citizen_memories,
    memory_text
  )
values
  (
    'ec700000-0000-0000-0000-000000000001',
    'ec200000-0000-0000-0000-000000000001',
    'ec600000-0000-0000-0000-000000000001',
    'Settlement Event',
    'pending',
    'deposit_discovered',
    4, -- activate_on_transition_after_turn_number < current turn (5) → fires
    'settlement',
    'ec400000-0000-0000-0000-000000000001',
    'instant',
    true,
    'A settlement memory'
  );

-- Event 2: nation-scoped, create_citizen_memories=true, pending
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
    scope_nation_id,
    duration_type,
    create_citizen_memories,
    memory_text
  )
values
  (
    'ec700000-0000-0000-0000-000000000002',
    'ec200000-0000-0000-0000-000000000001',
    'ec600000-0000-0000-0000-000000000001',
    'Nation Event',
    'pending',
    'deposit_discovered',
    4,
    'nation',
    'ec300000-0000-0000-0000-000000000001',
    'instant',
    true,
    'A nation memory'
  );

-- Event 3: world-scoped, create_citizen_memories=true, pending
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
    create_citizen_memories,
    memory_text
  )
values
  (
    'ec700000-0000-0000-0000-000000000003',
    'ec200000-0000-0000-0000-000000000001',
    'ec600000-0000-0000-0000-000000000001',
    'World Event',
    'pending',
    'deposit_discovered',
    4,
    'world',
    'instant',
    true,
    'A world memory'
  );

-- Event 4: world-scoped, create_citizen_memories=false, pending
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
    create_citizen_memories
  )
values
  (
    'ec700000-0000-0000-0000-000000000004',
    'ec200000-0000-0000-0000-000000000001',
    'ec600000-0000-0000-0000-000000000001',
    'No Memory Event',
    'pending',
    'deposit_discovered',
    4,
    'world',
    'instant',
    false
  );

-- Event 5: world-scoped, create_citizen_memories=true, already ACTIVE (not first activation)
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
    remaining_transitions,
    create_citizen_memories,
    memory_text
  )
values
  (
    'ec700000-0000-0000-0000-000000000005',
    'ec200000-0000-0000-0000-000000000001',
    'ec600000-0000-0000-0000-000000000001',
    'Already Active Event',
    'active',
    'deposit_discovered',
    4,
    'world',
    'sustained',
    3,
    2,
    true,
    'Already active memory'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Turn transition infrastructure
-- ─────────────────────────────────────────────────────────────────────────────
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
    'ec800000-0000-0000-0000-000000000001',
    'ec200000-0000-0000-0000-000000000001',
    'ec100000-0000-0000-0000-000000000001',
    'running',
    5,
    6
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Invoke the helper directly (bypasses the full orchestrator for isolation)
-- ─────────────────────────────────────────────────────────────────────────────
-- Patches representing the simulation output for events 1–5:
--   event 1: pending→expired (settlement, instant)
--   event 2: pending→expired (nation, instant)
--   event 3: pending→expired (world, instant)
--   event 4: pending→expired (world, instant, no-memories flag)
--   event 5: active→active   (world, sustained mid-run — fires every active turn)
do $$
declare
  v_patches jsonb := jsonb_build_array(
    jsonb_build_object('eventId', 'ec700000-0000-0000-0000-000000000001',
                       'fromStatus', 'pending', 'toStatus', 'expired',
                       'remainingTransitions', null),
    jsonb_build_object('eventId', 'ec700000-0000-0000-0000-000000000002',
                       'fromStatus', 'pending', 'toStatus', 'expired',
                       'remainingTransitions', null),
    jsonb_build_object('eventId', 'ec700000-0000-0000-0000-000000000003',
                       'fromStatus', 'pending', 'toStatus', 'expired',
                       'remainingTransitions', null),
    jsonb_build_object('eventId', 'ec700000-0000-0000-0000-000000000004',
                       'fromStatus', 'pending', 'toStatus', 'expired',
                       'remainingTransitions', null),
    jsonb_build_object('eventId', 'ec700000-0000-0000-0000-000000000005',
                       'fromStatus', 'active', 'toStatus', 'active',
                       'remainingTransitions', 1)
  );
  v_payload jsonb := jsonb_build_object('eventStatusPatches', v_patches);
begin
  perform public.internal_apply_turn_transition_event_patches(
    'ec200000-0000-0000-0000-000000000001'::uuid,
    'ec800000-0000-0000-0000-000000000001'::uuid,
    6,
    v_payload
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 1: Settlement scope → exactly the 2 alive citizens of settlement A1
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000001'
    ),
    2,
    'settlement-scoped event creates memories for exactly 2 alive citizens in that settlement'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 2: Nation scope → alive citizens of A1 (2) + A2 (1) = 3, not B1
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000002'
    ),
    3,
    'nation-scoped event creates memories for 3 alive citizens in nation A settlements'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 3: World scope → all alive citizens: A1(2) + A2(1) + B1(1) = 4
-- (DeadDan excluded)
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000003'
    ),
    4,
    'world-scoped event creates memories for 4 alive citizens, excluding dead'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 4: Dead citizen explicitly excluded from world-scope event
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000003'
        and citizen_id = 'ec500000-0000-0000-0000-000000000003'
    ),
    0,
    'dead citizen (DeadDan) gets no memory from world-scoped event'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 5: create_citizen_memories = false → zero memories
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000004'
    ),
    0,
    'event with create_citizen_memories=false produces zero memories'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 6: Active (non-first) turn of a sustained event still fans out memories
-- to the 4 alive world citizens (fromStatus=active, not just first activation)
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000005'
    ),
    4,
    'active sustained event fans out memories on a non-first turn'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- A new citizen enters world scope, then the same sustained event fires again
-- on a later turn (re-applying the event 5 patch).
-- ─────────────────────────────────────────────────────────────────────────────
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
    'ec500000-0000-0000-0000-000000000006',
    'ec200000-0000-0000-0000-000000000001',
    'ec400000-0000-0000-0000-000000000003',
    'npc',
    'Eve',
    'alive',
    null
  );

do $$
declare
  v_payload jsonb := jsonb_build_object(
    'eventStatusPatches',
    jsonb_build_array(
      jsonb_build_object('eventId', 'ec700000-0000-0000-0000-000000000005',
                         'fromStatus', 'active', 'toStatus', 'active',
                         'remainingTransitions', 0)
    )
  );
begin
  perform public.internal_apply_turn_transition_event_patches(
    'ec200000-0000-0000-0000-000000000001'::uuid,
    'ec800000-0000-0000-0000-000000000001'::uuid,
    7,
    v_payload
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 7: Re-firing does not duplicate — the 4 original citizens are unchanged
-- and only the newcomer is added, so the total is 5 (not 8).
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000005'
    ),
    5,
    're-firing a sustained event adds only the new citizen, never duplicates'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 8: The newly-arrived citizen received exactly one memory for the event
-- ─────────────────────────────────────────────────────────────────────────────
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_memories
      where
        event_id = 'ec700000-0000-0000-0000-000000000005'
        and citizen_id = 'ec500000-0000-0000-0000-000000000006'
    ),
    1,
    'citizen new to scope on a later turn receives exactly one event memory'
  );

select
  *
from
  finish ();

rollback;
