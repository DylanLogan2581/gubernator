-- pgTAP tests for inputs_json / outputs_json validation on job_definitions.
-- Covers: malformed shape, unknown resource_id, cross-world resource_id,
-- soft-deleted resource_id, and valid happy path.
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
    'b1000000-0000-0000-0000-000000000001',
    'iov-owner@example.com',
    'x',
    now(),
    '{"username":"iov_owner"}'::jsonb,
    now(),
    now()
  );

-- Two worlds: world 1 is where job_definitions live; world 2 provides
-- cross-world resources for the rejection tests.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'IOV Private World',
    'b1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'IOV Other World',
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

-- ===========================================================================
-- SHAPE VALIDATION — inputs_json
-- All tests run as the postgres superuser (no role set) so RLS is bypassed
-- and only CHECK constraints are exercised.
-- ===========================================================================
-- inputs_json is a string, not an array
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't1', 'standard', 1,
      '"not an array"'
    )
    $test$,
    '23514',
    null,
    'inputs_json that is not an array is rejected'
  );

-- Element is not an object (it is a number)
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't2', 'standard', 1,
      '[42]'
    )
    $test$,
    '23514',
    null,
    'inputs_json with non-object element is rejected'
  );

-- Element missing resource_id
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't3', 'standard', 1,
      '[{"amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element missing resource_id is rejected'
  );

-- resource_id is a number, not a string
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't4', 'standard', 1,
      '[{"resource_id": 1, "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element with numeric resource_id is rejected'
  );

-- Element missing amount_per_worker
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't5', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001"}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element missing amount_per_worker is rejected'
  );

-- amount_per_worker is a string, not a number
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't6', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": "ten"}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element with string amount_per_worker is rejected'
  );

-- notes is present but is a number, not a string
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't7', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 1, "notes": 42}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element with non-string notes is rejected'
  );

-- Extra key present
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't8', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 1, "extra": true}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element with extra key is rejected'
  );

-- ===========================================================================
-- RESOURCE EXISTENCE — inputs_json
-- ===========================================================================
-- resource_id does not exist in any world
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't9', 'standard', 1,
      '[{"resource_id": "00000000-0000-0000-0000-000000000000", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element with unknown resource_id is rejected'
  );

-- resource_id belongs to a different world
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't10', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000002", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element with cross-world resource_id is rejected'
  );

-- resource_id is soft-deleted
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't11', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000003", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'inputs_json element referencing soft-deleted resource is rejected'
  );

-- ===========================================================================
-- OUTPUTS_JSON column is also validated
-- ===========================================================================
-- outputs_json is a string, not an array
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, outputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't12', 'standard', 1,
      '"not an array"'
    )
    $test$,
    '23514',
    null,
    'outputs_json that is not an array is rejected'
  );

-- outputs_json with unknown resource_id
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, outputs_json)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Test', 't13', 'standard', 1,
      '[{"resource_id": "00000000-0000-0000-0000-000000000000", "amount_per_worker": 1}]'
    )
    $test$,
    '23514',
    null,
    'outputs_json element with unknown resource_id is rejected'
  );

-- ===========================================================================
-- HAPPY PATH
-- ===========================================================================
-- Default empty arrays are accepted
select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'b2000000-0000-0000-0000-000000000001',
      'Empty Arrays Job', 'empty-arrays-job', 'standard', 1
    )
    $test$,
    'empty inputs_json and outputs_json (defaults) are accepted'
  );

-- Valid inputs_json with one entry
select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b4000000-0000-0000-0000-000000000002',
      'b2000000-0000-0000-0000-000000000001',
      'Valid Input Job', 'valid-input-job', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 2}]'
    )
    $test$,
    'valid inputs_json with one entry is accepted'
  );

-- Valid entry with optional notes field
select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json)
    values (
      'b4000000-0000-0000-0000-000000000003',
      'b2000000-0000-0000-0000-000000000001',
      'Notes Job', 'notes-job', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 1.5, "notes": "handled carefully"}]'
    )
    $test$,
    'valid inputs_json entry with notes is accepted'
  );

-- Valid outputs_json with one entry
select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, outputs_json)
    values (
      'b4000000-0000-0000-0000-000000000004',
      'b2000000-0000-0000-0000-000000000001',
      'Valid Output Job', 'valid-output-job', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 3}]'
    )
    $test$,
    'valid outputs_json with one entry is accepted'
  );

-- Multiple entries in both arrays
select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json, outputs_json)
    values (
      'b4000000-0000-0000-0000-000000000005',
      'b2000000-0000-0000-0000-000000000001',
      'Multi Entry Job', 'multi-entry-job', 'standard', 1,
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 1},
        {"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 2}]',
      '[{"resource_id": "b3000000-0000-0000-0000-000000000001", "amount_per_worker": 5}]'
    )
    $test$,
    'job_definitions with multiple IO entries is accepted'
  );

select
  *
from
  finish ();

rollback;
