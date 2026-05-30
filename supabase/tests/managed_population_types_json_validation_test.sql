-- pgTAP tests for maintenance_rules_json and culling_outputs_json validation
-- on managed_population_types.
-- Covers: malformed shape, unknown resource_id, cross-world resource_id,
-- soft-deleted resource_id, and valid happy paths.
-- Run with: npx supabase test db
begin;

select
  plan (15);

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
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'MPTV Main World',
    'f1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'MPTV Other World',
    'f1000000-0000-0000-0000-000000000001',
    'private',
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
  public.resources (id, world_id, name, slug, is_deleted)
values
  (
    'f3000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'Old Hay',
    'old-hay',
    true
  );

-- Husbandry and culling job pairs — one per test that inserts a pop type row.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Cattle Husbandry',
    'cattle-husbandry',
    'husbandry'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Cattle Culling',
    'cattle-culling',
    'culling'
  );

-- Extra job pairs for each test that inserts a pop type row.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
select
  format(
    'f4000000-0000-0000-0000-%s',
    lpad((n * 2 + 1)::text, 12, '0')
  )::uuid,
  'f2000000-0000-0000-0000-000000000001',
  format('Husbandry %s', n),
  format('husbandry-%s', n),
  'husbandry'
from
  generate_series(1, 16) as n;

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
select
  format(
    'f4000000-0000-0000-0000-%s',
    lpad((n * 2 + 2)::text, 12, '0')
  )::uuid,
  'f2000000-0000-0000-0000-000000000001',
  format('Culling %s', n),
  format('culling-%s', n),
  'culling'
from
  generate_series(1, 16) as n;

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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt1',
      'f4000000-0000-0000-0000-000000000003',
      'f4000000-0000-0000-0000-000000000004',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt2',
      'f4000000-0000-0000-0000-000000000005',
      'f4000000-0000-0000-0000-000000000006',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt3',
      'f4000000-0000-0000-0000-000000000007',
      'f4000000-0000-0000-0000-000000000008',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt4',
      'f4000000-0000-0000-0000-000000000009',
      'f4000000-0000-0000-0000-000000000010',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt5',
      'f4000000-0000-0000-0000-000000000011',
      'f4000000-0000-0000-0000-000000000012',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'mt6',
      'f4000000-0000-0000-0000-000000000013',
      'f4000000-0000-0000-0000-000000000014',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co1',
      'f4000000-0000-0000-0000-000000000015',
      'f4000000-0000-0000-0000-000000000016',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co2',
      'f4000000-0000-0000-0000-000000000017',
      'f4000000-0000-0000-0000-000000000018',
      1, 0,
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
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, culling_outputs_json
    )
    values (
      'f2000000-0000-0000-0000-000000000001',
      'Test', 'co3',
      'f4000000-0000-0000-0000-000000000019',
      'f4000000-0000-0000-0000-000000000020',
      1, 0,
      '[{"resource_id": "f3000000-0000-0000-0000-000000000003", "amount_per_n_animals": 1}]'
    )
    $test$,
    '23514',
    null,
    'culling_outputs_json element referencing soft-deleted resource is rejected'
  );

-- ===========================================================================
-- HAPPY PATH
-- ===========================================================================
-- Default empty arrays are accepted
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'f5000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'Empty Rules Pop', 'empty-rules-pop',
      'f4000000-0000-0000-0000-000000000001',
      'f4000000-0000-0000-0000-000000000002',
      1, 0
    )
    $test$,
    'empty maintenance_rules_json and culling_outputs_json (default) are accepted'
  );

-- Valid maintenance_rules_json with one entry
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, maintenance_rules_json
    )
    values (
      'f5000000-0000-0000-0000-000000000002',
      'f2000000-0000-0000-0000-000000000001',
      'Maintained Pop', 'maintained-pop',
      'f4000000-0000-0000-0000-000000000021',
      'f4000000-0000-0000-0000-000000000022',
      2, 0.05,
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
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate, culling_outputs_json
    )
    values (
      'f5000000-0000-0000-0000-000000000003',
      'f2000000-0000-0000-0000-000000000001',
      'Culling Pop', 'culling-pop',
      'f4000000-0000-0000-0000-000000000023',
      'f4000000-0000-0000-0000-000000000024',
      1, 0.10,
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
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate,
      maintenance_rules_json, culling_outputs_json
    )
    values (
      'f5000000-0000-0000-0000-000000000004',
      'f2000000-0000-0000-0000-000000000001',
      'Full Pop', 'full-pop',
      'f4000000-0000-0000-0000-000000000025',
      'f4000000-0000-0000-0000-000000000026',
      3, 0.08,
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
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'f5000000-0000-0000-0000-000000000005',
      'f2000000-0000-0000-0000-000000000001',
      'Zero Growth Pop', 'zero-growth-pop',
      'f4000000-0000-0000-0000-000000000027',
      'f4000000-0000-0000-0000-000000000028',
      1, 0
    )
    $test$,
    'growth_rate of zero is accepted'
  );

-- husbandry_workers_per_n_animals = 1 is accepted (minimum positive value)
select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'f5000000-0000-0000-0000-000000000006',
      'f2000000-0000-0000-0000-000000000001',
      'Min Workers Pop', 'min-workers-pop',
      'f4000000-0000-0000-0000-000000000029',
      'f4000000-0000-0000-0000-000000000030',
      1, 0
    )
    $test$,
    'husbandry_workers_per_n_animals = 1 is accepted'
  );

select
  *
from
  finish ();

rollback;
