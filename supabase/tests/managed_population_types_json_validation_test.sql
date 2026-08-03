-- pgTAP tests for maintenance_rules_json and culling_outputs_json validation
-- on managed_population_types.
-- Covers: malformed shape, unknown resource_id, cross-world resource_id,
-- soft-deleted resource_id, and valid happy paths.
-- Run with: npx supabase test db
begin;

select
  plan (18);

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
    'f1000000-0000-0000-0000-000000000001',
    'mptv-owner@example.com',
    'x',
    now(),
    '{"username":"mptv_owner"}'::jsonb,
    now(),
    now()
  );

-- World 1: where managed_population_types live.
-- World 2: provides cross-world resources for rejection tests.
insert into
  public.worlds (id, name, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'MPTV Main World',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'MPTV Other World',
    'active'
  );

-- Grain: valid, non-deleted resource in world 1
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Grain',
    'grain'
  );

-- Wool: resource in world 2 (cross-world rejection tests)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'Wool',
    'wool'
  );

-- Old Hay: soft-deleted resource in world 1
insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'f3000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'Old Hay',
    'old-hay',
    true
  );

-- ===========================================================================
-- MAINTENANCE_RULES_JSON SHAPE VALIDATION
-- All tests run as the postgres superuser (no role set) so RLS is bypassed
-- and only CHECK constraints are exercised.
-- ===========================================================================
-- maintenance_rules_json is a string, not an array
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt1',
      0,
      '"not an array"'
    )
    $test$,
    '23514',
    null,
    'maintenance_rules_json that is not an array is rejected'
  );

-- Element missing resource_id
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt2',
      0,
      '[{"amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'maintenance_rules_json element missing resource_id is rejected'
  );

-- amount_per_n_animals is a string, not a number
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt3',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": "ten"}]'
    )
    $test$,
    '23514',
    null,
    'maintenance_rules_json element with string amount_per_n_animals is rejected'
  );

-- Extra key present
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt4',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 1, "extra": true}]'
    )
    $test$,
    '23514',
    null,
    'maintenance_rules_json element with extra key is rejected'
  );

-- resource_id belongs to a different world
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt5',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000002", "amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'maintenance_rules_json element with cross-world resource_id is rejected'
  );

-- resource_id is soft-deleted
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt6',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000003", "amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'maintenance_rules_json element referencing soft-deleted resource is rejected'
  );

-- ===========================================================================
-- CULLING_OUTPUTS_JSON SHAPE VALIDATION
-- ===========================================================================
-- culling_outputs_json is a string, not an array
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co1',
      0,
      '"not an array"'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json that is not an array is rejected'
  );

-- resource_id belongs to a different world
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co2',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000002", "amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element with cross-world resource_id is rejected'
  );

-- resource_id is soft-deleted
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co3',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000003", "amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element referencing soft-deleted resource is rejected'
  );

-- element missing resource_id
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co4',
      0,
      '[{"amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element missing resource_id is rejected'
  );

-- amount_per_n_animals is a string, not a number
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co5',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": "ten"}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element with string amount_per_n_animals is rejected'
  );

-- extra key present
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co6',
      0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 1, "extra": true}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element with extra key is rejected'
  );

-- resource_id does not exist in any world
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co7',
      0,
      '[{"resource_id": "00000000-0000-0000-0000-000000000000", "amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element with unknown resource_id is rejected'
  );

-- ===========================================================================
-- HAPPY PATH
-- ===========================================================================
-- Default empty arrays are accepted
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate
    )
    values (
      'f5000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'Empty Rules Pop', 'empty-rules-pop',
      0
    )
    $test$,
    'empty maintenance_rules_json and culling_outputs_json (default) are accepted'
  );

-- Valid maintenance_rules_json with one entry
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate, maintenance_rules_json
    )
    values (
      'f5000000-0000-0000-0000-000000000002',
      'f2000000-0000-0000-0000-000000000001',
      'Maintained Pop', 'maintained-pop',
      0.05,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 3}]'
    )
    $test$,
    'valid maintenance_rules_json with one entry is accepted'
  );

-- Valid culling_outputs_json with one entry
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate, culling_outputs_json
    )
    values (
      'f5000000-0000-0000-0000-000000000003',
      'f2000000-0000-0000-0000-000000000001',
      'Culling Pop', 'culling-pop',
      0.10,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 5}]'
    )
    $test$,
    'valid culling_outputs_json with one entry is accepted'
  );

-- Both valid with multiple entries
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate,
      maintenance_rules_json, culling_outputs_json
    )
    values (
      'f5000000-0000-0000-0000-000000000004',
      'f2000000-0000-0000-0000-000000000001',
      'Full Pop', 'full-pop',
      0.08,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 2},
        {"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 1}]',
      '[{"resource_id": "f3000000-0000-0000-0000-000000000001", "amount_per_n_animals": 4}]'
    )
    $test$,
    'valid maintenance_rules_json and culling_outputs_json with multiple entries are accepted'
  );

-- growth_rate of zero is accepted
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate
    )
    values (
      'f5000000-0000-0000-0000-000000000005',
      'f2000000-0000-0000-0000-000000000001',
      'Zero Growth Pop', 'zero-growth-pop',
      0
    )
    $test$,
    'growth_rate of zero is accepted'
  );

select
  *
from
  finish ();

rollback;
