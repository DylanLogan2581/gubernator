-- pgTAP tests for public.managed_population_types RLS, unique job linkage,
-- distinct-job check, and numeric column constraints.
-- Run with: npx supabase test db
begin;

select
  plan (27);

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
    'mpt-owner@example.com',
    'x',
    now(),
    '{"username":"mpt_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'mpt-admin@example.com',
    'x',
    now(),
    '{"username":"mpt_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'mpt-outsider@example.com',
    'x',
    now(),
    '{"username":"mpt_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'mpt-superadmin@example.com',
    'x',
    now(),
    '{"username":"mpt_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'MPT Private World',
    'e1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'MPT Public World',
    'e1000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000003',
    'MPT Outsider World',
    'e1000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002'
  );

-- Husbandry and culling job pairs for RLS tests and constraint tests.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  -- World 1: seeded pop type pair
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Cattle Husbandry',
    'cattle-husbandry',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Cattle Culling',
    'cattle-culling',
    'culling'
  ),
  -- World 2: seeded pop type pair
  (
    'e3000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000002',
    'Sheep Husbandry',
    'sheep-husbandry',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000002',
    'Sheep Culling',
    'sheep-culling',
    'culling'
  ),
  -- World 1: owner write test pair
  (
    'e3000000-0000-0000-0000-000000000005',
    'e2000000-0000-0000-0000-000000000001',
    'Owner Husbandry',
    'owner-husbandry',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000006',
    'e2000000-0000-0000-0000-000000000001',
    'Owner Culling',
    'owner-culling',
    'culling'
  ),
  -- World 1: admin write test pair
  (
    'e3000000-0000-0000-0000-000000000007',
    'e2000000-0000-0000-0000-000000000001',
    'Admin Husbandry',
    'admin-husbandry',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000008',
    'e2000000-0000-0000-0000-000000000001',
    'Admin Culling',
    'admin-culling',
    'culling'
  ),
  -- World 3: super admin write test pair
  (
    'e3000000-0000-0000-0000-000000000009',
    'e2000000-0000-0000-0000-000000000003',
    'Super Husbandry',
    'super-husbandry',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000010',
    'e2000000-0000-0000-0000-000000000003',
    'Super Culling',
    'super-culling',
    'culling'
  ),
  -- World 1: constraint test jobs
  -- e3..020 / e3..021: seed the "Constraint Herd" row; reused for dup tests
  (
    'e3000000-0000-0000-0000-000000000020',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Husbandry A',
    'constraint-husbandry-a',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000021',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Culling A',
    'constraint-culling-a',
    'culling'
  ),
  -- e3..022: extra culling job for the duplicate-husbandry test
  (
    'e3000000-0000-0000-0000-000000000022',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Culling B',
    'constraint-culling-b',
    'culling'
  ),
  -- e3..023: extra husbandry job for the duplicate-culling test
  (
    'e3000000-0000-0000-0000-000000000023',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Husbandry B',
    'constraint-husbandry-b',
    'husbandry'
  ),
  -- e3..024: single job for the same-job collision test
  (
    'e3000000-0000-0000-0000-000000000024',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Husbandry C',
    'constraint-husbandry-c',
    'husbandry'
  ),
  -- e3..025 / e3..026: pair for the zero-workers test
  (
    'e3000000-0000-0000-0000-000000000025',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Husbandry D',
    'constraint-husbandry-d',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000026',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Culling D',
    'constraint-culling-d',
    'culling'
  ),
  -- e3..027 / e3..028: pair for the negative-growth test
  (
    'e3000000-0000-0000-0000-000000000027',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Husbandry E',
    'constraint-husbandry-e',
    'husbandry'
  ),
  (
    'e3000000-0000-0000-0000-000000000028',
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Culling E',
    'constraint-culling-e',
    'culling'
  );

-- Seed a population type in the private world for write tests.
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    growth_rate
  )
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Cattle',
    'cattle',
    'e3000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000002',
    2,
    0.05
  );

-- Seed a population type in the public world for outsider read tests.
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    growth_rate
  )
values
  (
    'e4000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    'Sheep',
    'sheep',
    'e3000000-0000-0000-0000-000000000003',
    'e3000000-0000-0000-0000-000000000004',
    1,
    0.10
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
        public.managed_population_types
    ),
    0,
    'anon cannot read managed_population_types'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world types; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read managed_population_types in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read managed_population_types in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Outsider Herd', 'outsider-herd',
      'e3000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000002',
      1, 0
    )
    $test$,
    '42501',
    null,
    'outsider cannot insert managed_population_types into an inaccessible world'
  );

update public.managed_population_types
set
  name = 'Outsider Update'
where
  id = 'e4000000-0000-0000-0000-000000000001';

delete from public.managed_population_types
where
  id = 'e4000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.managed_population_types
      where
        id = 'e4000000-0000-0000-0000-000000000001'
    ),
    'Cattle',
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        id = 'e4000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage managed_population_types in their world
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
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'owner can read managed_population_types in their world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e4000000-0000-0000-0000-000000000010',
      'e2000000-0000-0000-0000-000000000001',
      'Owner Herd', 'owner-herd',
      'e3000000-0000-0000-0000-000000000005',
      'e3000000-0000-0000-0000-000000000006',
      3, 0.02
    )
    $test$,
    'owner can insert managed_population_types in their world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_types
    set name = 'Owner Updated'
    where id = 'e4000000-0000-0000-0000-000000000010'
    $test$,
    'owner can update managed_population_types in their world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_types
    where id = 'e4000000-0000-0000-0000-000000000010'
    $test$,
    'owner can delete managed_population_types in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage managed_population_types
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
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read managed_population_types in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e4000000-0000-0000-0000-000000000011',
      'e2000000-0000-0000-0000-000000000001',
      'Admin Herd', 'admin-herd',
      'e3000000-0000-0000-0000-000000000007',
      'e3000000-0000-0000-0000-000000000008',
      5, 0.03
    )
    $test$,
    'world admin can insert managed_population_types in the administered world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_types
    set name = 'Admin Updated'
    where id = 'e4000000-0000-0000-0000-000000000011'
    $test$,
    'world admin can update managed_population_types in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_types
    where id = 'e4000000-0000-0000-0000-000000000011'
    $test$,
    'world admin can delete managed_population_types in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage managed_population_types across all worlds
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
        public.managed_population_types
      where
        world_id in (
          'e2000000-0000-0000-0000-000000000001',
          'e2000000-0000-0000-0000-000000000002',
          'e2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read managed_population_types across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e4000000-0000-0000-0000-000000000012',
      'e2000000-0000-0000-0000-000000000003',
      'Super Herd', 'super-herd',
      'e3000000-0000-0000-0000-000000000009',
      'e3000000-0000-0000-0000-000000000010',
      4, 0.08
    )
    $test$,
    'super admin can insert managed_population_types in any world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_types
    set name = 'Super Updated'
    where id = 'e4000000-0000-0000-0000-000000000012'
    $test$,
    'super admin can update managed_population_types in any world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_types
    where id = 'e4000000-0000-0000-0000-000000000012'
    $test$,
    'super admin can delete managed_population_types in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- Seed a population type to enable duplicate-job constraint tests.
insert into
  public.managed_population_types (
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    growth_rate
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Constraint Herd',
    'constraint-herd',
    'e3000000-0000-0000-0000-000000000020',
    'e3000000-0000-0000-0000-000000000021',
    1,
    0
  );

-- Duplicate active husbandry_job_id must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Dup Husbandry Herd', 'dup-husbandry-herd',
      'e3000000-0000-0000-0000-000000000020',
      'e3000000-0000-0000-0000-000000000022',
      1, 0
    )
    $test$,
    '23505',
    null,
    'duplicate active husbandry_job_id rejected by partial unique index'
  );

-- Duplicate active culling_job_id must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Dup Culling Herd', 'dup-culling-herd',
      'e3000000-0000-0000-0000-000000000023',
      'e3000000-0000-0000-0000-000000000021',
      1, 0
    )
    $test$,
    '23505',
    null,
    'duplicate active culling_job_id rejected by partial unique index'
  );

-- After trashing the constraint-herd, the same job_ids may be reused.
update public.managed_population_types
set
  is_active = false
where
  husbandry_job_id = 'e3000000-0000-0000-0000-000000000020';

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Relinked Husbandry Herd', 'relinked-husbandry-herd',
      'e3000000-0000-0000-0000-000000000020',
      'e3000000-0000-0000-0000-000000000022',
      1, 0
    )
    $test$,
    'inactive record permits same husbandry_job_id for a new active record'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Relinked Culling Herd', 'relinked-culling-herd',
      'e3000000-0000-0000-0000-000000000023',
      'e3000000-0000-0000-0000-000000000021',
      1, 0
    )
    $test$,
    'inactive record permits same culling_job_id for a new active record'
  );

-- With new active records present, further active records with the same job_ids must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Second Dup Husbandry', 'second-dup-husbandry',
      'e3000000-0000-0000-0000-000000000020',
      'e3000000-0000-0000-0000-000000000028',
      1, 0
    )
    $test$,
    '23505',
    null,
    'second active record with same husbandry_job_id rejected after relinking'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Second Dup Culling', 'second-dup-culling',
      'e3000000-0000-0000-0000-000000000027',
      'e3000000-0000-0000-0000-000000000021',
      1, 0
    )
    $test$,
    '23505',
    null,
    'second active record with same culling_job_id rejected after relinking'
  );

-- Same job used for both husbandry and culling must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Same Job Herd', 'same-job-herd',
      'e3000000-0000-0000-0000-000000000024',
      'e3000000-0000-0000-0000-000000000024',
      1, 0
    )
    $test$,
    '23514',
    null,
    'husbandry_job_id = culling_job_id rejected by distinct-jobs check'
  );

-- husbandry_workers_per_n_animals = 0 must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Zero Workers Herd', 'zero-workers-herd',
      'e3000000-0000-0000-0000-000000000025',
      'e3000000-0000-0000-0000-000000000026',
      0, 0
    )
    $test$,
    '23514',
    null,
    'husbandry_workers_per_n_animals = 0 rejected by check constraint'
  );

-- negative growth_rate must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Negative Growth Herd', 'negative-growth-herd',
      'e3000000-0000-0000-0000-000000000027',
      'e3000000-0000-0000-0000-000000000028',
      1, -0.01
    )
    $test$,
    '23514',
    null,
    'negative growth_rate rejected by check constraint'
  );

select
  *
from
  finish ();

rollback;
