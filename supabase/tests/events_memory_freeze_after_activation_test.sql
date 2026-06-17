-- pgTAP tests for the events_freeze_memory_after_activation trigger.
-- Once an event leaves 'pending', its create_citizen_memories flag and
-- memory_text are immutable; status/remaining_transitions and other columns
-- stay editable.
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
    'fb100000-0000-0000-0000-000000000001',
    'evfreeze-owner@example.com',
    'x',
    now(),
    '{"username":"evfreeze_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'fb200000-0000-0000-0000-000000000001',
    'Event Freeze World',
    'private',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'fb200000-0000-0000-0000-000000000001',
    'fb100000-0000-0000-0000-000000000001'
  );

insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'fb600000-0000-0000-0000-000000000001',
    'fb200000-0000-0000-0000-000000000001',
    'Freeze Group',
    5
  );

-- Pending event (memory config still editable)
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
    'fb700000-0000-0000-0000-000000000001',
    'fb200000-0000-0000-0000-000000000001',
    'fb600000-0000-0000-0000-000000000001',
    'Pending Event',
    'pending',
    'deposit_discovered',
    4,
    'world',
    'instant',
    true,
    'Original pending text'
  );

-- Active event (memory config frozen)
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
    'fb700000-0000-0000-0000-000000000002',
    'fb200000-0000-0000-0000-000000000001',
    'fb600000-0000-0000-0000-000000000001',
    'Active Event',
    'active',
    'deposit_discovered',
    4,
    'world',
    'sustained',
    3,
    2,
    true,
    'Active frozen text'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 1: memory_text editable while pending
-- ─────────────────────────────────────────────────────────────────────────────
select
  lives_ok (
    $$
    update public.events
    set memory_text = 'Edited pending text'
    where id = 'fb700000-0000-0000-0000-000000000001'
    $$,
    'memory_text is editable while the event is pending'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 2: memory_text frozen once active
-- ─────────────────────────────────────────────────────────────────────────────
select
  throws_ok (
    $$
    update public.events
    set memory_text = 'Tampered text'
    where id = 'fb700000-0000-0000-0000-000000000002'
    $$,
    'P0001',
    'Cannot change citizen-memory settings once an event has activated',
    'changing memory_text on an active event is rejected'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 3: create_citizen_memories frozen once active
-- ─────────────────────────────────────────────────────────────────────────────
select
  throws_ok (
    $$
    update public.events
    set create_citizen_memories = false
    where id = 'fb700000-0000-0000-0000-000000000002'
    $$,
    'P0001',
    'Cannot change citizen-memory settings once an event has activated',
    'toggling create_citizen_memories on an active event is rejected'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 4: status / remaining_transitions still editable (turn-transition path)
-- ─────────────────────────────────────────────────────────────────────────────
select
  lives_ok (
    $$
    update public.events
    set status = 'expired', remaining_transitions = 0
    where id = 'fb700000-0000-0000-0000-000000000002'
    $$,
    'status and remaining_transitions remain editable on an active event'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 5: unrelated columns (name) still editable on an active event
-- ─────────────────────────────────────────────────────────────────────────────
select
  lives_ok (
    $$
    update public.events
    set name = 'Renamed Active Event'
    where id = 'fb700000-0000-0000-0000-000000000002'
    $$,
    'unrelated columns remain editable on an active event'
  );

select
  *
from
  finish ();

rollback;
