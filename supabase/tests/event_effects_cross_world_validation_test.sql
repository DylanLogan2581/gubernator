-- pgTAP tests for #963: event_effects reference columns accept cross-world ids.
-- Verifies create_event_group_with_events and update_event_group_with_events
-- reject resource_id, job_id, deposit_instance_id, and
-- managed_population_instance_id references that belong to a foreign world.
-- Run with: npx supabase test db
--
-- UUID prefix map (all ee-prefixed ranges, unique to this file):
--   ee100000 = users
--   ee200000 = worlds
--   ee300000 = nations
--   ee400000 = settlements
--   ee500000 = resources
--   ee600000 = job_definitions
--   ee700000 = deposit_types
--   ee800000 = deposit_instances
--   ee900000 = managed_population_types
--   eea00000 = managed_population_instances
--   eeb00000 = event_groups (update-path fixture)
--   eec00000 = events (update-path fixture)
begin;

select
  plan (10);

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
    'ee100000-0000-0000-0000-000000000001',
    'eecw-wadmin-a@example.com',
    'x',
    now(),
    '{"username":"eecw_wadmin_a"}'::jsonb,
    now(),
    now()
  );

-- World A (attacker is admin here) and World B (foreign world under attack)
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'EECW World A',
    0,
    'active'
  ),
  (
    'ee200000-0000-0000-0000-000000000002',
    'EECW World B',
    0,
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ee300000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Nation A'
  ),
  (
    'ee300000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Nation B'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ee400000-0000-0000-0000-000000000001',
    'ee300000-0000-0000-0000-000000000001',
    'EECW Settlement A'
  ),
  (
    'ee400000-0000-0000-0000-000000000002',
    'ee300000-0000-0000-0000-000000000002',
    'EECW Settlement B'
  );

-- Resources: one per world
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ee500000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Grain A',
    'eecw-grain-a'
  ),
  (
    'ee500000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Grain B',
    'eecw-grain-b'
  );

-- Job definitions: standard job per world for the job_id reference column,
-- plus deposit/husbandry/culling jobs per world backing the deposit_types and
-- managed_population_types fixtures below.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'ee600000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Farmer A',
    'eecw-farmer-a',
    'standard',
    10
  ),
  (
    'ee600000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Farmer B',
    'eecw-farmer-b',
    'standard',
    10
  ),
  (
    'ee600000-0000-0000-0000-000000000003',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Mining A',
    'eecw-mining-a',
    'deposit',
    null
  ),
  (
    'ee600000-0000-0000-0000-000000000004',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Mining B',
    'eecw-mining-b',
    'deposit',
    null
  ),
  (
    'ee600000-0000-0000-0000-000000000005',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Husbandry A',
    'eecw-husbandry-a',
    'husbandry',
    null
  ),
  (
    'ee600000-0000-0000-0000-000000000006',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Culling A',
    'eecw-culling-a',
    'culling',
    null
  ),
  (
    'ee600000-0000-0000-0000-000000000007',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Husbandry B',
    'eecw-husbandry-b',
    'husbandry',
    null
  ),
  (
    'ee600000-0000-0000-0000-000000000008',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Culling B',
    'eecw-culling-b',
    'culling',
    null
  );

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
    'ee700000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Ore A',
    'eecw-ore-a',
    'ee600000-0000-0000-0000-000000000003',
    1
  ),
  (
    'ee700000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Ore B',
    'eecw-ore-b',
    'ee600000-0000-0000-0000-000000000004',
    1
  );

insert into
  public.deposit_instances (
    id,
    settlement_id,
    deposit_type_id,
    name,
    status,
    max_workers
  )
values
  (
    'ee800000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'ee700000-0000-0000-0000-000000000001',
    'EECW Quarry A',
    'active',
    5
  ),
  (
    'ee800000-0000-0000-0000-000000000002',
    'ee400000-0000-0000-0000-000000000002',
    'ee700000-0000-0000-0000-000000000002',
    'EECW Quarry B',
    'active',
    5
  );

insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals
  )
values
  (
    'ee900000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Flock Type A',
    'eecw-flock-type-a',
    'ee600000-0000-0000-0000-000000000005',
    'ee600000-0000-0000-0000-000000000006',
    5
  ),
  (
    'ee900000-0000-0000-0000-000000000002',
    'ee200000-0000-0000-0000-000000000002',
    'EECW Flock Type B',
    'eecw-flock-type-b',
    'ee600000-0000-0000-0000-000000000007',
    'ee600000-0000-0000-0000-000000000008',
    5
  );

insert into
  public.managed_population_instances (
    id,
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    status
  )
values
  (
    'eea00000-0000-0000-0000-000000000001',
    'ee400000-0000-0000-0000-000000000001',
    'ee900000-0000-0000-0000-000000000001',
    'EECW Flock A',
    10,
    'active'
  ),
  (
    'eea00000-0000-0000-0000-000000000002',
    'ee400000-0000-0000-0000-000000000002',
    'ee900000-0000-0000-0000-000000000002',
    'EECW Flock B',
    10,
    'active'
  );

-- Update-path fixture: an event group + event already living in World A
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'eeb00000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'EECW Update Group',
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
    'eec00000-0000-0000-0000-000000000001',
    'ee200000-0000-0000-0000-000000000001',
    'eeb00000-0000-0000-0000-000000000001',
    'EECW Update Event',
    'resource_grant',
    'pending',
    0
  );

-- ===========================================================================
-- All tests run as the World A admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST 1: create_event_group_with_events — same-world references succeed
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'ee200000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Baseline Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'resource_grant',
          'amount_value', 10,
          'resource_id', 'ee500000-0000-0000-0000-000000000001'
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
    'create_event_group_with_events succeeds when every reference belongs to the caller''s world'
  );

-- ===========================================================================
-- TEST 2: create — foreign resource_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'ee200000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Attack resource_id',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'resource_grant',
          'amount_value', 10,
          'resource_id', 'ee500000-0000-0000-0000-000000000002'
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
    'create_event_group_with_events rejects a foreign-world resource_id'
  );

-- ===========================================================================
-- TEST 3: create — foreign job_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'ee200000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Attack job_id',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'population_loss',
          'amount_value', 10,
          'job_id', 'ee600000-0000-0000-0000-000000000002'
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
    'create_event_group_with_events rejects a foreign-world job_id'
  );

-- ===========================================================================
-- TEST 4: create — foreign deposit_instance_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'ee200000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Attack deposit_instance_id',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'deposit_instance_id', 'ee800000-0000-0000-0000-000000000002'
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
    'create_event_group_with_events rejects a foreign-world deposit_instance_id'
  );

-- ===========================================================================
-- TEST 5: create — foreign managed_population_instance_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_event_group_with_events(
      p_world_id                              := 'ee200000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Attack managed_population_instance_id',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'managed_population_change',
          'amount_value', 10,
          'managed_population_instance_id', 'eea00000-0000-0000-0000-000000000002'
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
    'create_event_group_with_events rejects a foreign-world managed_population_instance_id'
  );

-- ===========================================================================
-- TEST 6: update_event_group_with_events — same-world references succeed
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'eeb00000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Update Group (edited)',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'resource_grant',
          'amount_value', 10,
          'resource_id', 'ee500000-0000-0000-0000-000000000001'
        )
      ),
      p_duration_type                         := 'instant',
      p_duration_transitions                  := null,
      p_activate_on_transition_after_turn_number := 0,
      p_create_citizen_memories               := false,
      p_memory_text                           := null
    );
    $test$,
    'update_event_group_with_events succeeds when every reference belongs to the caller''s world'
  );

-- ===========================================================================
-- TEST 7: update — foreign resource_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'eeb00000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Update Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'resource_grant',
          'amount_value', 10,
          'resource_id', 'ee500000-0000-0000-0000-000000000002'
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
    'update_event_group_with_events rejects a foreign-world resource_id'
  );

-- ===========================================================================
-- TEST 8: update — foreign job_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'eeb00000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Update Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'population_loss',
          'amount_value', 10,
          'job_id', 'ee600000-0000-0000-0000-000000000002'
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
    'update_event_group_with_events rejects a foreign-world job_id'
  );

-- ===========================================================================
-- TEST 9: update — foreign deposit_instance_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'eeb00000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Update Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'deposit_destroyed',
          'deposit_instance_id', 'ee800000-0000-0000-0000-000000000002'
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
    'update_event_group_with_events rejects a foreign-world deposit_instance_id'
  );

-- ===========================================================================
-- TEST 10: update — foreign managed_population_instance_id rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.update_event_group_with_events(
      p_group_id                              := 'eeb00000-0000-0000-0000-000000000001',
      p_group_name                            := 'EECW Update Group',
      p_group_description                     := null,
      p_effects                               := jsonb_build_array(
        jsonb_build_object(
          'effect_type', 'managed_population_change',
          'amount_value', 10,
          'managed_population_instance_id', 'eea00000-0000-0000-0000-000000000002'
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
    'update_event_group_with_events rejects a foreign-world managed_population_instance_id'
  );

reset role;

select
  *
from
  finish ();

rollback;
