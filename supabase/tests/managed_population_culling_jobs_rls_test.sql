-- pgTAP tests for public.managed_population_culling_jobs RLS, and its
-- uniqueness / same-world / max_cull_per_worker / world_id-derivation
-- constraints. Mirrors deposit_type_jobs_rls_test.sql — world_id is
-- denormalized onto this table so RLS needs no join back to
-- managed_population_types.
-- Run with: npx supabase test db
begin;

select
  plan (24);

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
    'mpcj-owner@example.com',
    'x',
    now(),
    '{"username":"mpcj_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'mpcj-admin@example.com',
    'x',
    now(),
    '{"username":"mpcj_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'mpcj-outsider@example.com',
    'x',
    now(),
    '{"username":"mpcj_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'mpcj-superadmin@example.com',
    'x',
    now(),
    '{"username":"mpcj_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'MPCJ Private World',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'MPCJ Public World',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000003',
    'MPCJ Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  ),
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002'
  );

-- Culling jobs (one per world/purpose) and the population types they link to.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Slaughtering',
    'slaughtering',
    'culling'
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'Trapping',
    'trapping',
    'culling'
  ),
  -- Extra jobs for owner / admin / super-admin write tests.
  (
    'f3000000-0000-0000-0000-000000000010',
    'f2000000-0000-0000-0000-000000000001',
    'Owner Slaughtering',
    'owner-slaughtering',
    'culling'
  ),
  (
    'f3000000-0000-0000-0000-000000000011',
    'f2000000-0000-0000-0000-000000000001',
    'Admin Slaughtering',
    'admin-slaughtering',
    'culling'
  ),
  (
    'f3000000-0000-0000-0000-000000000012',
    'f2000000-0000-0000-0000-000000000001',
    'Super Admin Slaughtering',
    'super-admin-slaughtering',
    'culling'
  ),
  -- Extra jobs for constraint tests.
  (
    'f3000000-0000-0000-0000-000000000020',
    'f2000000-0000-0000-0000-000000000001',
    'Constraint Job A',
    'constraint-job-a',
    'culling'
  ),
  (
    'f3000000-0000-0000-0000-000000000021',
    'f2000000-0000-0000-0000-000000000001',
    'Constraint Job B',
    'constraint-job-b',
    'culling'
  ),
  (
    'f3000000-0000-0000-0000-000000000023',
    'f2000000-0000-0000-0000-000000000001',
    'Constraint Job C',
    'constraint-job-c',
    'culling'
  ),
  (
    'f3000000-0000-0000-0000-000000000024',
    'f2000000-0000-0000-0000-000000000001',
    'Constraint Job D',
    'constraint-job-d',
    'culling'
  ),
  -- Job in a different world, used for the same-world consistency test.
  (
    'f3000000-0000-0000-0000-000000000022',
    'f2000000-0000-0000-0000-000000000002',
    'Cross World Job',
    'cross-world-job',
    'culling'
  );

insert into
  public.managed_population_types (id, world_id, name, slug)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Cattle',
    'cattle'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'Sheep',
    'sheep'
  );

-- Seed a managed_population_culling_jobs row in the private world for write tests.
insert into
  public.managed_population_culling_jobs (
    id,
    managed_population_type_id,
    job_id,
    max_cull_per_worker
  )
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    5
  );

-- Seed a managed_population_culling_jobs row in the public world for outsider read tests.
insert into
  public.managed_population_culling_jobs (
    id,
    managed_population_type_id,
    job_id,
    max_cull_per_worker
  )
values
  (
    'f5000000-0000-0000-0000-000000000002',
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000002',
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
        public.managed_population_culling_jobs
    ),
    0,
    'anon cannot read managed_population_culling_jobs'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read no worlds; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_culling_jobs
      where
        world_id = 'f2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read managed_population_culling_jobs without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_culling_jobs
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read managed_population_culling_jobs in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000010',
      1
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert managed_population_culling_jobs into an inaccessible world'
  );

update public.managed_population_culling_jobs
set
  max_cull_per_worker = 99
where
  id = 'f5000000-0000-0000-0000-000000000001';

delete from public.managed_population_culling_jobs
where
  id = 'f5000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        max_cull_per_worker
      from
        public.managed_population_culling_jobs
      where
        id = 'f5000000-0000-0000-0000-000000000001'
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
        public.managed_population_culling_jobs
      where
        id = 'f5000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage managed_population_culling_jobs in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_culling_jobs
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
    ),
    'owner can read managed_population_culling_jobs in their world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_culling_jobs (id, managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f5000000-0000-0000-0000-000000000010',
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000010',
      10
    )
  $test$,
    'owner can insert managed_population_culling_jobs in their world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_culling_jobs
    set max_cull_per_worker = 12
    where id = 'f5000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update managed_population_culling_jobs in their world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_culling_jobs
    where id = 'f5000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete managed_population_culling_jobs in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage managed_population_culling_jobs in the world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_culling_jobs
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read managed_population_culling_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_culling_jobs (id, managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f5000000-0000-0000-0000-000000000011',
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000011',
      8
    )
  $test$,
    'world admin can insert managed_population_culling_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_culling_jobs
    set max_cull_per_worker = 9
    where id = 'f5000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update managed_population_culling_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_culling_jobs
    where id = 'f5000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete managed_population_culling_jobs in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage managed_population_culling_jobs across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_culling_jobs
      where
        world_id in (
          'f2000000-0000-0000-0000-000000000001',
          'f2000000-0000-0000-0000-000000000002',
          'f2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read managed_population_culling_jobs across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_culling_jobs (id, managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f5000000-0000-0000-0000-000000000012',
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000012',
      7
    )
  $test$,
    'super admin can insert managed_population_culling_jobs in any world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_culling_jobs
    set max_cull_per_worker = 11
    where id = 'f5000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can update managed_population_culling_jobs in any world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_culling_jobs
    where id = 'f5000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can delete managed_population_culling_jobs in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- A managed population type can link multiple distinct culling jobs.
select
  lives_ok (
    $test$
    insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000020',
      10
    )
  $test$,
    'a managed population type can link a second, distinct culling job'
  );

-- The same (managed_population_type_id, job_id) pair cannot be linked twice.
select
  throws_ok (
    $test$
    insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000020',
      5
    )
  $test$,
    '23505',
    null,
    'duplicate (managed_population_type_id, job_id) pair rejected by unique constraint'
  );

-- max_cull_per_worker = 0 must be accepted (check requires >= 0, unlike the
-- husbandry table's workers_per_n_animals which requires > 0).
select
  lives_ok (
    $test$
    insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000021',
      0
    )
  $test$,
    'max_cull_per_worker = 0 accepted by check constraint (>= 0)'
  );

-- max_cull_per_worker = -1 must be rejected (check requires >= 0).
select
  throws_ok (
    $test$
    insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000024',
      -1
    )
  $test$,
    '23514',
    null,
    'max_cull_per_worker = -1 rejected by check constraint'
  );

-- world_id is auto-derived from the parent managed_population_type when not
-- supplied explicitly (BEFORE INSERT trigger
-- set_managed_population_culling_job_world_id).
insert into
  public.managed_population_culling_jobs (
    id,
    managed_population_type_id,
    job_id,
    max_cull_per_worker
  )
values
  (
    'f5000000-0000-0000-0000-000000000023',
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000023',
    4
  );

select
  is (
    (
      select
        world_id
      from
        public.managed_population_culling_jobs
      where
        id = 'f5000000-0000-0000-0000-000000000023'
    ),
    'f2000000-0000-0000-0000-000000000001'::uuid,
    'world_id is auto-derived from the parent managed_population_type when omitted'
  );

-- job_id must belong to the same world as the managed population type
-- (composite FK). The FK is deferrable initially deferred (so template
-- import can insert managed_population_culling_jobs before job_definitions
-- commits within the same transaction), so force immediate checking to
-- observe the violation here rather than at this test file's final
-- rollback.
set constraints all immediate;

select
  throws_ok (
    $test$
    insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker)
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000022',
      5
    )
  $test$,
    '23503',
    null,
    'job from a different world than the managed population type is rejected'
  );

select
  *
from
  finish ();

rollback;
