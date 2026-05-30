-- pgTAP tests for worker_inputs_json validation on deposit_types.
-- Covers: malformed shape, unknown resource_id, cross-world resource_id,
-- soft-deleted resource_id, and valid happy path.
-- Run with: npx supabase test db
begin;

select
  plan (13);

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
    'b1000000-0000-0000-0000-000000000001',
    'dtv-owner@example.com',
    'x',
    now(),
    '{"username":"dtv_owner"}'::jsonb,
    now(),
    now()
  );

-- Two worlds: world 1 is where deposit_types live; world 2 provides
-- cross-world resources for the rejection tests.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'DTV Private World',
    'b1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'DTV Other World',
    'b1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Iron: valid, non-deleted resource in world 1
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'Iron',
    'iron'
  );

-- Wool: resource in world 2 (used to test cross-world rejection)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'b3000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002',
    'Wool',
    'wool'
  );

-- Old Stone: soft-deleted resource in world 1
insert into
  public.resources (id, world_id, name, slug, is_deleted)
values
  (
    'b3000000-0000-0000-0000-000000000003',
    'b2000000-0000-0000-0000-000000000001',
    'Old Stone',
    'old-stone',
    true
  );

-- Deposit job needed for the job_id FK on deposit_types.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'b4000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'Mining',
    'mining',
    'deposit'
  );

-- Extra deposit jobs for each test that inserts a deposit_type row.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
select
  format(
    'b4000000-0000-0000-0000-%s',
    lpad(n::text, 12, '0')
  )::uuid,
  'b2000000-0000-0000-0000-000000000001',
  format('Mining %s', n),
  format('mining-%s', n),
  'deposit'
from
  generate_series(2, 13) as n;

-- ===========================================================================
-- SHAPE VALIDATION
-- All tests run as the postgres superuser (no role set) so RLS is bypassed
-- and only CHECK constraints are exercised.
-- ===========================================================================
-- worker_inputs_json is a string, not an array
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't1', 'b4000000-0000-0000-0000-000000000002', 1,
      '"not an array"'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json that is not an array is rejected'
  );

-- Element is not an object (it is a number)
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't2', 'b4000000-0000-0000-0000-000000000003', 1,
      '[42]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json with non-object element is rejected'
  );

-- Element missing resource_id
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't3', 'b4000000-0000-0000-0000-000000000004', 1,
      '[{"amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element missing resource_id is rejected'
  );

-- resource_id is a number, not a string
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't4', 'b4000000-0000-0000-0000-000000000005', 1,
      '[{"resource_id": 1, "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element with numeric resource_id is rejected'
  );

-- Element missing amount_per_worker
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't5', 'b4000000-0000-0000-0000-000000000006', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001"}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element missing amount_per_worker is rejected'
  );

-- amount_per_worker is a string, not a number
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't6', 'b4000000-0000-0000-0000-000000000007', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": "ten"}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element with string amount_per_worker is rejected'
  );

-- Extra key present
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't7', 'b4000000-0000-0000-0000-000000000008', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 1, "extra": true}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element with extra key is rejected'
  );

-- ===========================================================================
-- RESOURCE EXISTENCE
-- ===========================================================================
-- resource_id does not exist in any world
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't8', 'b4000000-0000-0000-0000-000000000009', 1,
      '[{"resource_id": "00000000-0000-0000-0000-000000000000", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element with unknown resource_id is rejected'
  );

-- resource_id belongs to a different world
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't9', 'b4000000-0000-0000-0000-000000000010', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000002", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element with cross-world resource_id is rejected'
  );

-- resource_id is soft-deleted
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't10', 'b4000000-0000-0000-0000-000000000011', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000003", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'worker_inputs_json element referencing soft-deleted resource is rejected'
  );

-- ===========================================================================
-- HAPPY PATH
-- ===========================================================================
-- Default empty array is accepted
select
  lives_ok (
    $test$
    insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker)
    values (
      'b5000000-0000-0000-0000-000000000001',
      'b2000000-0000-0000-0000-000000000001',
      'Empty Inputs Deposit', 'empty-inputs-deposit',
      'b4000000-0000-0000-0000-000000000001', 5
    )
    $test$,
    'empty worker_inputs_json (default) is accepted'
  );

-- Valid worker_inputs_json with one entry
select
  lives_ok (
    $test$
    insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b5000000-0000-0000-0000-000000000002',
      'b2000000-0000-0000-0000-000000000001',
      'Valid Inputs Deposit', 'valid-inputs-deposit',
      'b4000000-0000-0000-0000-000000000012', 10,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 2}]'
    )
    $test$,
    'valid worker_inputs_json with one entry is accepted'
  );

-- Multiple entries in worker_inputs_json
select
  lives_ok (
    $test$
    insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json)
    values (
      'b5000000-0000-0000-0000-000000000003',
      'b2000000-0000-0000-0000-000000000001',
      'Multi Inputs Deposit', 'multi-inputs-deposit',
      'b4000000-0000-0000-0000-000000000013', 4,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 1},
        {"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 3}]'
    )
    $test$,
    'deposit_types with multiple worker_inputs entries is accepted'
  );

select
  *
from
  finish ();

rollback;
