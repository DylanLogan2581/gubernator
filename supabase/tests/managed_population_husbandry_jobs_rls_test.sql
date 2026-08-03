-- pgTAP tests for public.managed_population_husbandry_jobs RLS, and its
-- uniqueness / same-world / workers_per_n_animals / world_id-derivation
-- constraints. Mirrors deposit_type_jobs_rls_test.sql — world_id is
-- denormalized onto this table so RLS needs no join back to
-- managed_population_types.
-- Run with: npx supabase test db
begin;

select
  plan (23);

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
    'e1000000-0000-0000-0000-000000000001',
    'hbj-owner@example.com',
    'x',
    now(),
    '{"username":"hbj_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'hbj-admin@example.com',
    'x',
    now(),
    '{"username":"hbj_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'hbj-outsider@example.com',
    'x',
    now(),
    '{"username":"hbj_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'hbj-superadmin@example.com',
    'x',
    now(),
    '{"username":"hbj_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'HBJ Private World',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'HBJ Public World',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000003',
    'HBJ Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002'
  );

-- Husbandry jobs (one per world/purpose) and the population types they link to.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Ranching',
    'ranching',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    'Herding',
    'herding',
    'husbandry'
  ),
  -- Extra jobs for owner / admin / super-admin write tests.
  (
    'e3000000-0000-0000-0000-000000000010',
    'e2000000-0000-0000-0000-000000000001',
    'Owner Ranching',
    'owner-ranching',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000011',
    'e2000000-0000-0000-0000-000000000001',
    'Admin Ranching',
    'admin-ranching',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000012',
    'e2000000-0000-0000-0000-000000000001',
    'Super Admin Ranching',
    'super-admin-ranching',
    'husbandry'
  ),
  -- Extra jobs for constraint tests.
  (
    'e3000000-0000-0000-0000-000000000020',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Job A',
    'constraint-job-a',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000021',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Job B',
    'constraint-job-b',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000023',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Job C',
    'constraint-job-c',
    'husbandry'
  ),
  -- Job in a different world, used for the same-world consistency test.
  (
    'e3000000-0000-0000-0000-000000000022',
    'e2000000-0000-0000-0000-000000000002',
    'Cross World Job',
    'cross-world-job',
    'husbandry'
  );

insert into
  public.managed_population_types (id, world_id, name, slug)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Cattle',
    'cattle'
  ),
  (
    'e4000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    'Sheep',
    'sheep'
  );

-- Seed a managed_population_husbandry_jobs row in the private world for write tests.
insert into
  public.managed_population_husbandry_jobs (
    id,
    managed_population_type_id,
    job_id,
    workers_per_n_animals
  )
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    5
  );

-- Seed a managed_population_husbandry_jobs row in the public world for outsider read tests.
insert into
  public.managed_population_husbandry_jobs (
    id,
    managed_population_type_id,
    job_id,
    workers_per_n_animals
  )
values
  (
    'e5000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000002',
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
        public.managed_population_husbandry_jobs
    ),
    0,
    'anon cannot read managed_population_husbandry_jobs'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read no worlds; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_husbandry_jobs
      where
        world_id = 'e2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read managed_population_husbandry_jobs without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_husbandry_jobs
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read managed_population_husbandry_jobs in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000010',
      1
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert managed_population_husbandry_jobs into an inaccessible world'
  );

update public.managed_population_husbandry_jobs
set
  workers_per_n_animals = 99
where
  id = 'e5000000-0000-0000-0000-000000000001';

delete from public.managed_population_husbandry_jobs
where
  id = 'e5000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        workers_per_n_animals
      from
        public.managed_population_husbandry_jobs
      where
        id = 'e5000000-0000-0000-0000-000000000001'
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
        public.managed_population_husbandry_jobs
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage managed_population_husbandry_jobs in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_husbandry_jobs
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'owner can read managed_population_husbandry_jobs in their world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (id, managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e5000000-0000-0000-0000-000000000010',
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000010',
      10
    )
  $test$,
    'owner can insert managed_population_husbandry_jobs in their world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_husbandry_jobs
    set workers_per_n_animals = 12
    where id = 'e5000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update managed_population_husbandry_jobs in their world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_husbandry_jobs
    where id = 'e5000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete managed_population_husbandry_jobs in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage managed_population_husbandry_jobs in the world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_husbandry_jobs
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read managed_population_husbandry_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (id, managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e5000000-0000-0000-0000-000000000011',
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000011',
      8
    )
  $test$,
    'world admin can insert managed_population_husbandry_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_husbandry_jobs
    set workers_per_n_animals = 9
    where id = 'e5000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update managed_population_husbandry_jobs in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_husbandry_jobs
    where id = 'e5000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete managed_population_husbandry_jobs in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage managed_population_husbandry_jobs across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_husbandry_jobs
      where
        world_id in (
          'e2000000-0000-0000-0000-000000000001',
          'e2000000-0000-0000-0000-000000000002',
          'e2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read managed_population_husbandry_jobs across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (id, managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e5000000-0000-0000-0000-000000000012',
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000012',
      7
    )
  $test$,
    'super admin can insert managed_population_husbandry_jobs in any world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_husbandry_jobs
    set workers_per_n_animals = 11
    where id = 'e5000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can update managed_population_husbandry_jobs in any world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_husbandry_jobs
    where id = 'e5000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can delete managed_population_husbandry_jobs in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- A managed population type can link multiple distinct husbandry jobs.
select
  lives_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000020',
      10
    )
  $test$,
    'a managed population type can link a second, distinct husbandry job'
  );

-- The same (managed_population_type_id, job_id) pair cannot be linked twice.
select
  throws_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000020',
      5
    )
  $test$,
    '23505',
    null,
    'duplicate (managed_population_type_id, job_id) pair rejected by unique constraint'
  );

-- workers_per_n_animals = 0 must be rejected (check requires > 0).
select
  throws_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000021',
      0
    )
  $test$,
    '23514',
    null,
    'workers_per_n_animals = 0 rejected by check constraint'
  );

-- world_id is auto-derived from the parent managed_population_type when not
-- supplied explicitly (BEFORE INSERT trigger
-- set_managed_population_husbandry_job_world_id).
insert into
  public.managed_population_husbandry_jobs (
    id,
    managed_population_type_id,
    job_id,
    workers_per_n_animals
  )
values
  (
    'e5000000-0000-0000-0000-000000000023',
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000023',
    4
  );

select
  is (
    (
      select
        world_id
      from
        public.managed_population_husbandry_jobs
      where
        id = 'e5000000-0000-0000-0000-000000000023'
    ),
    'e2000000-0000-0000-0000-000000000001'::uuid,
    'world_id is auto-derived from the parent managed_population_type when omitted'
  );

-- job_id must belong to the same world as the managed population type
-- (composite FK). The FK is deferrable initially deferred (so template
-- import can insert managed_population_husbandry_jobs before
-- job_definitions commits within the same transaction), so force immediate
-- checking to observe the violation here rather than at this test file's
-- final rollback.
set constraints all immediate;

select
  throws_ok (
    $test$
    insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals)
    values (
      'e4000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000022',
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
