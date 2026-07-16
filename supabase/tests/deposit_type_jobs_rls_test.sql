-- pgTAP tests for public.deposit_type_jobs RLS, and its uniqueness /
-- same-world / output_units_per_worker constraints. Mirrors
-- deposit_types_rls_test.sql — world_id is denormalized onto this table so
-- RLS needs no join back to deposit_types.
-- Run with: npx supabase test db
begin;

select
  plan (22);

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
    'c1000000-0000-0000-0000-000000000001',
    'dtj-owner@example.com',
    'x',
    now(),
    '{"username":"dtj_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'dtj-admin@example.com',
    'x',
    now(),
    '{"username":"dtj_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'dtj-outsider@example.com',
    'x',
    now(),
    '{"username":"dtj_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'dtj-superadmin@example.com',
    'x',
    now(),
    '{"username":"dtj_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'DTJ Private World',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'DTJ Public World',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    'DTJ Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

-- Deposit type jobs (one per world/purpose) and the deposit types they link to.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Mining',
    'mining',
    'deposit'
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'Quarrying',
    'quarrying',
    'deposit'
  ),
  -- Extra jobs for owner / admin / super-admin write tests.
  (
    'c3000000-0000-0000-0000-000000000010',
    'c2000000-0000-0000-0000-000000000001',
    'Owner Mining',
    'owner-mining',
    'deposit'
  ),
  (
    'c3000000-0000-0000-0000-000000000011',
    'c2000000-0000-0000-0000-000000000001',
    'Admin Mining',
    'admin-mining',
    'deposit'
  ),
  (
    'c3000000-0000-0000-0000-000000000012',
    'c2000000-0000-0000-0000-000000000003',
    'Super Admin Mining',
    'super-admin-mining',
    'deposit'
  ),
  -- Extra jobs for constraint tests.
  (
    'c3000000-0000-0000-0000-000000000020',
    'c2000000-0000-0000-0000-000000000001',
    'Constraint Job A',
    'constraint-job-a',
    'deposit'
  ),
  (
    'c3000000-0000-0000-0000-000000000021',
    'c2000000-0000-0000-0000-000000000001',
    'Constraint Job B',
    'constraint-job-b',
    'deposit'
  ),
  -- Job in a different world, used for the same-world consistency test.
  (
    'c3000000-0000-0000-0000-000000000022',
    'c2000000-0000-0000-0000-000000000002',
    'Cross World Job',
    'cross-world-job',
    'deposit'
  );

insert into
  public.deposit_types (id, world_id, name, slug)
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Iron Deposit',
    'iron-deposit'
  ),
  (
    'c4000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'Stone Deposit',
    'stone-deposit'
  );

-- Seed a deposit_type_jobs row in the private world for write tests.
insert into
  public.deposit_type_jobs (
    id,
    deposit_type_id,
    job_id,
    output_units_per_worker
  )
values
  (
    'c5000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    5
  );

-- Seed a deposit_type_jobs row in the public world for outsider read tests.
insert into
  public.deposit_type_jobs (
    id,
    deposit_type_id,
    job_id,
    output_units_per_worker
  )
values
  (
    'c5000000-0000-0000-0000-000000000002',
    'c4000000-0000-0000-0000-000000000002',
    'c3000000-0000-0000-0000-000000000002',
    3
  );

-- ===========================================================================
-- ANONYMOUS: no read access
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_type_jobs
    ),
    0,
    'anon cannot read deposit_type_jobs'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read no worlds; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.deposit_type_jobs
      where
        world_id = 'c2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read deposit_type_jobs without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.deposit_type_jobs
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read deposit_type_jobs in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000010',
      1
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert deposit_type_jobs into an inaccessible world'
  );

update public.deposit_type_jobs
set
  output_units_per_worker = 99
where
  id = 'c5000000-0000-0000-0000-000000000001';

delete from public.deposit_type_jobs
where
  id = 'c5000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        output_units_per_worker
      from
        public.deposit_type_jobs
      where
        id = 'c5000000-0000-0000-0000-000000000001'
    ),
    5,
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.deposit_type_jobs
      where
        id = 'c5000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage deposit_type_jobs in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.deposit_type_jobs
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'owner can read deposit_type_jobs in their world'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_type_jobs (id, deposit_type_id, job_id, output_units_per_worker)
    values (
      'c5000000-0000-0000-0000-000000000010',
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000010',
      10
    )
  $test$,
    'owner can insert deposit_type_jobs in their world'
  );

select
  lives_ok (
    $test$
    update public.deposit_type_jobs
    set output_units_per_worker = 12
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update deposit_type_jobs in their world'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_type_jobs
    where id = 'c5000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete deposit_type_jobs in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage deposit_type_jobs in the world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.deposit_type_jobs
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read deposit_type_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_type_jobs (id, deposit_type_id, job_id, output_units_per_worker)
    values (
      'c5000000-0000-0000-0000-000000000011',
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000011',
      8
    )
  $test$,
    'world admin can insert deposit_type_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    update public.deposit_type_jobs
    set output_units_per_worker = 9
    where id = 'c5000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update deposit_type_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_type_jobs
    where id = 'c5000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete deposit_type_jobs in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage deposit_type_jobs across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_type_jobs
      where
        world_id in (
          'c2000000-0000-0000-0000-000000000001',
          'c2000000-0000-0000-0000-000000000002',
          'c2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read deposit_type_jobs across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_type_jobs (id, deposit_type_id, job_id, output_units_per_worker)
    values (
      'c5000000-0000-0000-0000-000000000012',
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000012',
      7
    )
  $test$,
    'super admin can insert deposit_type_jobs in any world'
  );

select
  lives_ok (
    $test$
    update public.deposit_type_jobs
    set output_units_per_worker = 11
    where id = 'c5000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can update deposit_type_jobs in any world'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_type_jobs
    where id = 'c5000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can delete deposit_type_jobs in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- A deposit type can link multiple distinct jobs (the whole point of #1246).
select
  lives_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000020',
      10
    )
  $test$,
    'a deposit type can link a second, distinct job'
  );

-- The same (deposit_type_id, job_id) pair cannot be linked twice.
select
  throws_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000020',
      5
    )
  $test$,
    '23505',
    null,
    'duplicate (deposit_type_id, job_id) pair rejected by unique constraint'
  );

-- output_units_per_worker = 0 must be rejected (check requires > 0).
select
  throws_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000021',
      0
    )
  $test$,
    '23514',
    null,
    'output_units_per_worker = 0 rejected by check constraint'
  );

-- job_id must belong to the same world as the deposit type (composite FK).
-- The FK is deferrable initially deferred (so template import can insert
-- deposit_type_jobs before job_definitions commits within the same
-- transaction), so force immediate checking to observe the violation here
-- rather than at this test file's final rollback.
set constraints all immediate;

select
  throws_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000022',
      5
    )
  $test$,
    '23503',
    null,
    'job from a different world than the deposit type is rejected'
  );

select
  *
from
  finish ();

rollback;
