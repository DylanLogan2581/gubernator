-- pgTAP tests for public.create_managed_population_instance RPC.
-- Run with: npx supabase test db
begin;

select
  plan (9);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all e-prefixed, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = managed_population_types
--   e6xxxxxx = job_definitions
--   e7xxxxxx = citizens
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
    'cmpi-owner@example.com',
    'x',
    now(),
    '{"username":"cmpi_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'cmpi-world-admin@example.com',
    'x',
    now(),
    '{"username":"cmpi_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'cmpi-superadmin@example.com',
    'x',
    now(),
    '{"username":"cmpi_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'cmpi-nation-manager@example.com',
    'x',
    now(),
    '{"username":"cmpi_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'cmpi-outsider@example.com',
    'x',
    now(),
    '{"username":"cmpi_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000003';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'CMPI World',
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

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'CMPI Settlement'
  );

-- Job definitions needed for managed population type FKs
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Husbandry',
    'cmpi-husbandry',
    'husbandry'
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Culling',
    'cmpi-culling',
    'culling'
  ),
  (
    'e6000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Husbandry 2',
    'cmpi-husbandry-2',
    'husbandry'
  ),
  (
    'e6000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Culling 2',
    'cmpi-culling-2',
    'culling'
  );

-- Active managed population type
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
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Sheep',
    'cmpi-sheep',
    'e6000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000002',
    10,
    0.05
  );

-- Trashed managed population type
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    growth_rate,
    is_trashed
  )
values
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'CMPI Old Goat',
    'cmpi-old-goat',
    'e6000000-0000-0000-0000-000000000003',
    'e6000000-0000-0000-0000-000000000004',
    5,
    0.02,
    true
  );

-- Nation manager citizen
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'CMPI Nation Manager PC',
    'alive',
    'e1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'e3000000-0000-0000-0000-000000000001',
    null
  );

-- ===========================================================================
-- WORLD ADMIN: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'Northern Sheep Herd',
      100,
      10
    )
  $test$,
    'world admin can create a managed population instance'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'Southern Sheep Herd',
      200,
      0
    )
  $test$,
    'super admin can create a managed population instance'
  );

reset role;

-- Verify newly created instance has status='active'
select
  is (
    (
      select
        status
      from
        public.managed_population_instances
      where
        settlement_id = 'e4000000-0000-0000-0000-000000000001'
        and name = 'Northern Sheep Herd'
    ),
    'active',
    'newly created managed population instance has status active'
  );

-- ===========================================================================
-- NATION MANAGER: rejected (managers excluded per spec)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'Manager Herd',
      50,
      0
    )
  $test$,
    '42501',
    null,
    'nation manager is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ANONYMOUS: rejected (42501)
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'Anon Herd',
      50,
      0
    )
  $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- TRASHED TYPE: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000002',
      'Trashed Type Herd',
      50,
      0
    )
  $test$,
    'P0001',
    null,
    'trashed managed population type is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- INITIAL COUNT = 0: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'Zero Count Herd',
      0,
      0
    )
  $test$,
    'P0001',
    null,
    'initial count of 0 is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- CULL > COUNT: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_managed_population_instance(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'Over-Cull Herd',
      50,
      51
    )
  $test$,
    'P0001',
    null,
    'cull quantity exceeding count is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- SECURITY DEFINER: function must be SECURITY DEFINER
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'create_managed_population_instance'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'create_managed_population_instance is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
