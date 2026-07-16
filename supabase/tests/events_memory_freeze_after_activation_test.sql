-- pgTAP tests for the event_memories_freeze_after_activation trigger.
-- Once an event leaves 'pending', its event_memories rows are immutable:
-- no insert, update, or delete is allowed against them. status/
-- remaining_transitions and other event columns stay editable.
--
-- Runs inside a transaction that is rolled back; leaves no permanent data.
begin;

select
  plan (6);

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
  public.worlds (id, name, status, current_turn_number)
values
  (
    'fb200000-0000-0000-0000-000000000001',
    'Event Freeze World',
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

-- Pending event (memory rows still editable)
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
    duration_type
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
    'instant'
  );

-- Active event (memory rows frozen)
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
    'fb700000-0000-0000-0000-000000000002',
    'fb200000-0000-0000-0000-000000000001',
    'fb600000-0000-0000-0000-000000000001',
    'Active Event',
    'pending',
    'deposit_discovered',
    4,
    'world',
    'sustained',
    3,
    3
  );

-- Both parent events are still 'pending' here, so the event_memories freeze
-- trigger allows these inserts; event ...002 is advanced to 'active' below.
insert into
  public.event_memories (id, event_id, memory_text, turn_offset)
values
  (
    'fb800000-0000-0000-0000-000000000001',
    'fb700000-0000-0000-0000-000000000001',
    'Original pending text',
    0
  ),
  (
    'fb800000-0000-0000-0000-000000000002',
    'fb700000-0000-0000-0000-000000000002',
    'Active frozen text',
    1
  );

update public.events
set
  status = 'active',
  remaining_transitions = 2
where
  id = 'fb700000-0000-0000-0000-000000000002';

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 1: memory_text editable while the parent event is pending
-- ─────────────────────────────────────────────────────────────────────────────
select
  lives_ok (
    $$
    update public.event_memories
    set memory_text = 'Edited pending text'
    where id = 'fb800000-0000-0000-0000-000000000001'
    $$,
    'memory_text is editable while the parent event is pending'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 2: a new memory row can be inserted for a pending event
-- ─────────────────────────────────────────────────────────────────────────────
select
  lives_ok (
    $$
    insert into public.event_memories (event_id, memory_text, turn_offset)
    values ('fb700000-0000-0000-0000-000000000001', 'Second pending memory', 0)
    on conflict (event_id, turn_offset) do nothing
    $$,
    'a new memory row can be inserted while the parent event is pending'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 3: memory_text frozen once the parent event is active
-- ─────────────────────────────────────────────────────────────────────────────
select
  throws_ok (
    $$
    update public.event_memories
    set memory_text = 'Tampered text'
    where id = 'fb800000-0000-0000-0000-000000000002'
    $$,
    'P0001',
    'Cannot change citizen-memory settings once an event has activated',
    'changing memory_text on an active event''s memory is rejected'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 4: inserting a new memory row for an active event is rejected
-- ─────────────────────────────────────────────────────────────────────────────
select
  throws_ok (
    $$
    insert into public.event_memories (event_id, memory_text, turn_offset)
    values ('fb700000-0000-0000-0000-000000000002', 'New memory after activation', 2)
    $$,
    'P0001',
    'Cannot change citizen-memory settings once an event has activated',
    'inserting a memory row for an already-active event is rejected'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 5: deleting a memory row for an active event is rejected
-- ─────────────────────────────────────────────────────────────────────────────
select
  throws_ok (
    $$
    delete from public.event_memories
    where id = 'fb800000-0000-0000-0000-000000000002'
    $$,
    'P0001',
    'Cannot change citizen-memory settings once an event has activated',
    'deleting an active event''s memory row is rejected'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 6: unrelated event columns (status/remaining_transitions) still
-- editable, and don't trip the event_memories freeze trigger
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

select
  *
from
  finish ();

rollback;
