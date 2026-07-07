-- pgTAP tests for #1024: deposit_destroyed "all of a deposit type in scope" mode.
-- Verifies create_event_group_with_events / update_event_group_with_events accept a
-- deposit_destroyed effect targeted by deposit_type_id + extra_data_jsonb mode (no
-- deposit_instance_id required), reject an incomplete type-mode selection, and reject
-- a deposit_type_id belonging to a foreign world. The engine's resolution of "type" mode
-- to matching deposit instances at application time is covered by
-- supabase/functions/_shared/simulation/phases/phaseEvents.test.ts (a TypeScript concern,
-- not a SQL one — event_effects has no world_id column of its own to assert against here).
-- Run with: npx supabase test db
--
-- UUID prefix map (all fed-prefixed ranges, unique to this file):
--   fed10000 = users
--   fed20000 = worlds
--   fed30000 = nations
--   fed40000 = settlements
--   fed50000 = job_definitions
--   fed60000 = deposit_types
--   fed70000 = event_groups (update-path fixture)
--   fed80000 = events (update-path fixture)
begin;

select
  plan (6);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
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
    'fed10000-0000-0000-0000-000000000001',
    'fed-wadmin@example.com',
    'x',
    now(),
    '{"username":"fed_wadmin"}'::jsonb,
    now(),
    now()
  );

-- World A (caller's world) and World B (foreign world, for the reject case)
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'fed20000-0000-0000-0000-000000000001',
    'FED World A',
    0,
    'private',
    'active'
  ),
  (
    'fed20000-0000-0000-0000-000000000002',
    'FED World B',
    0,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'fed20000-0000-0000-0000-000000000001',
    'fed10000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'fed30000-0000-0000-0000-000000000001',
    'fed20000-0000-0000-0000-000000000001',
    'FED Nation A'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fed40000-0000-0000-0000-000000000001',
    'fed30000-0000-0000-0000-000000000001',
    'FED Settlement A'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'fed50000-0000-0000-0000-000000000001',
    'fed20000-0000-0000-0000-000000000001',
    'FED Mining A',
    'fed-mining-a',
    'deposit',
    null
  ),
  (
    'fed50000-0000-0000-0000-000000000002',
    'fed20000-0000-0000-0000-000000000002',
    'FED Mining B',
    'fed-mining-b',
    'deposit',
    null
  );

-- Deposit type in the caller's world, and a foreign-world deposit type for the reject case.
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'fed60000-0000-0000-0000-000000000001',
    'fed20000-0000-0000-0000-000000000001',
    'FED Iron Vein A',
    'fed-iron-vein-a',
    'fed50000-0000-0000-0000-000000000001',
    1
  ),
  (
    'fed60000-0000-0000-0000-000000000002',
    'fed20000-0000-0000-0000-000000000002',
    'FED Iron Vein B',
    'fed-iron-vein-b',
    'fed50000-0000-0000-0000-000000000002',
    1
  );

-- Update-path fixture: an event group + event already living in World A
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'fed70000-0000-0000-0000-000000000001',
    'fed20000-0000-0000-0000-000000000001',
    'FED Update Group',
    0
  );

insert into
  public.events (
    id,
    world_id,
    event_group_id,
    name,
    effect_type,
    status,
    activate_on_transition_after_turn_number
  )
values
  (
    'fed80000-0000-0000-0000-000000000001',
    'fed20000-0000-0000-0000-000000000001',
    'fed70000-0000-0000-0000-000000000001',
    'FED Update Event',
    'deposit_destroyed',
    'pending',
    0
  );

-- ===========================================================================
-- All tests run as the World A admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fed10000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST 1: create — type mode with a same-world deposit_type_id succeeds
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'fed20000-0000-0000-0000-000000000001',
      p_group_name                            := 'FED Type Mode Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'extra_data_jsonb', jsonb_build_object(
            'deposit_destroyed_mode', 'type',
            'deposit_type_id', 'fed60000-0000-0000-0000-000000000001'
          )
        )
      ),
      p_scope_type                            := 'settlement',
      p_targets                               := jsonb_build_array(
        jsonb_build_object('scope_id', 'fed40000-0000-0000-0000-000000000001', 'scope_name', 'FED Settlement A')
      ),
      p_duration_type                         := 'instant',
      p_duration_transitions                  := null,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    'create_event_group_with_events accepts deposit_destroyed type mode with no deposit_instance_id'
  );

-- ===========================================================================
-- TEST 2: the persisted effect row has no deposit_instance_id and carries the
-- type-mode extra_data_jsonb selection
-- ===========================================================================
select
  results_eq (
    $test$
    select ee.deposit_instance_id is null, ee.extra_data_jsonb->>'deposit_destroyed_mode', ee.extra_data_jsonb->>'deposit_type_id'
    from public.event_effects ee
    join public.events e on e.id = ee.event_id
    where e.event_group_id in (
      select id from public.event_groups where name = 'FED Type Mode Group'
    )
    $test$,
    $expected$
    values (true, 'type', 'fed60000-0000-0000-0000-000000000001')
    $expected$,
    'persisted deposit_destroyed effect carries the type-mode selection, not an instance id'
  );

-- ===========================================================================
-- TEST 3: create — type mode missing deposit_type_id is rejected (neither
-- deposit_instance_id nor a complete type-mode selection is present)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'fed20000-0000-0000-0000-000000000001',
      p_group_name                            := 'FED Incomplete Type Mode',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'extra_data_jsonb', jsonb_build_object('deposit_destroyed_mode', 'type')
        )
      ),
      p_scope_type                            := 'world',
      p_targets                               := jsonb_build_array(jsonb_build_object('scope_name', 'World-wide')),
      p_duration_type                         := 'instant',
      p_duration_transitions                  := null,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    '22023',
    null,
    'create_event_group_with_events rejects deposit_destroyed type mode without a deposit_type_id'
  );

-- ===========================================================================
-- TEST 4: create — a foreign-world deposit_type_id is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'fed20000-0000-0000-0000-000000000001',
      p_group_name                            := 'FED Attack deposit_type_id',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'extra_data_jsonb', jsonb_build_object(
            'deposit_destroyed_mode', 'type',
            'deposit_type_id', 'fed60000-0000-0000-0000-000000000002'
          )
        )
      ),
      p_scope_type                            := 'world',
      p_targets                               := jsonb_build_array(jsonb_build_object('scope_name', 'World-wide')),
      p_duration_type                         := 'instant',
      p_duration_transitions                  := null,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    '23503',
    null,
    'create_event_group_with_events rejects a foreign-world deposit_type_id'
  );

-- ===========================================================================
-- TEST 5: update — type mode with a same-world deposit_type_id succeeds
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'fed70000-0000-0000-0000-000000000001',
      p_group_name                            := 'FED Update Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'extra_data_jsonb', jsonb_build_object(
            'deposit_destroyed_mode', 'type',
            'deposit_type_id', 'fed60000-0000-0000-0000-000000000001'
          )
        )
      ),
      p_duration_type                         := 'instant',
      p_duration_transitions                  := null,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    'update_event_group_with_events accepts deposit_destroyed type mode with no deposit_instance_id'
  );

-- ===========================================================================
-- TEST 6: update — a foreign-world deposit_type_id is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'fed70000-0000-0000-0000-000000000001',
      p_group_name                            := 'FED Update Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'extra_data_jsonb', jsonb_build_object(
            'deposit_destroyed_mode', 'type',
            'deposit_type_id', 'fed60000-0000-0000-0000-000000000002'
          )
        )
      ),
      p_duration_type                         := 'instant',
      p_duration_transitions                  := null,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    '23503',
    null,
    'update_event_group_with_events rejects a foreign-world deposit_type_id'
  );

select
  *
from
  finish ();

rollback;
