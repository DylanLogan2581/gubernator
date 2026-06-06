-- pgTAP tests for public.create_deposit_instance RPC.
-- Run with: npx supabase test db
begin;

select
  plan (11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all f-prefixed, unique to this file):
--   f1xxxxxx = users          f2xxxxxx = worlds
--   f3xxxxxx = nations        f4xxxxxx = settlements
--   f5xxxxxx = deposit_types  f6xxxxxx = resources
--   f7xxxxxx = citizens       f8xxxxxx = job_definitions
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
    'cdi-owner@example.com',
    'x',
    now(),
    '{"username":"cdi_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'cdi-world-admin@example.com',
    'x',
    now(),
    '{"username":"cdi_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'cdi-superadmin@example.com',
    'x',
    now(),
    '{"username":"cdi_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'cdi-nation-manager@example.com',
    'x',
    now(),
    '{"username":"cdi_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000005',
    'cdi-outsider@example.com',
    'x',
    now(),
    '{"username":"cdi_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1000000-0000-0000-0000-000000000003';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'CDI World',
    'private',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'CDI Other World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CDI Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'CDI Settlement'
  );

-- Job definitions needed for deposit type FK
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CDI Mining',
    'cdi-mining',
    'deposit'
  ),
  (
    'f8000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'CDI Quarrying',
    'cdi-quarrying',
    'deposit'
  );

-- Deposit type in the world
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
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Iron Seam',
    'iron-seam-cdi',
    'f8000000-0000-0000-0000-000000000001',
    10
  );

-- Trashed deposit type
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker,
    is_trashed
  )
values
  (
    'f5000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Ruined Seam',
    'ruined-seam-cdi',
    'f8000000-0000-0000-0000-000000000002',
    5,
    true
  );

-- Resources
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore-cdi'
  ),
  -- Soft-deleted resource
  (
    'f6000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Old Coal',
    'old-coal-cdi'
  ),
  -- Resource in another world
  (
    'f6000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000002',
    'Foreign Stone',
    'foreign-stone-cdi'
  );

update public.resources
set
  is_trashed = true
where
  id = 'f6000000-0000-0000-0000-000000000002';

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
    'f7000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'CDI Nation Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'f3000000-0000-0000-0000-000000000001',
    null
  );

-- ===========================================================================
-- WORLD OWNER (implicit world admin): success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Iron Seam Alpha',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":500}]'::jsonb
    )
  $test$,
    'world owner can create a deposit instance'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Iron Seam Beta',
      4,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":200}]'::jsonb
    )
  $test$,
    'world admin can create a deposit instance'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Iron Seam Gamma',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":300}]'::jsonb
    )
  $test$,
    'super admin can create a deposit instance'
  );

reset role;

-- Verify newly created instance has status='active'
select
  is (
    (
      select
        status
      from
        public.deposit_instances
      where
        settlement_id = 'f4000000-0000-0000-0000-000000000001'
        and name = 'Iron Seam Alpha'
    ),
    'active',
    'newly created deposit instance has status active'
  );

-- ===========================================================================
-- NATION MANAGER: rejected (managers excluded per spec)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Manager Seam',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":100}]'::jsonb
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
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Anon Seam',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":100}]'::jsonb
    )
  $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- TRASHED DEPOSIT TYPE: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000002',
      'Trashed Type Seam',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":100}]'::jsonb
    )
  $test$,
    'P0001',
    null,
    'trashed deposit type is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- SOFT-DELETED RESOURCE: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Deleted Resource Seam',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000002","initial_quantity":100}]'::jsonb
    )
  $test$,
    'P0001',
    null,
    'soft-deleted resource is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD RESOURCE: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'Cross-World Seam',
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000003","initial_quantity":100}]'::jsonb
    )
  $test$,
    'P0001',
    null,
    'cross-world resource is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- NAME TOO LONG (65 characters): rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_deposit_instance(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      repeat('x', 65),
      null,
      '[{"resource_id":"f6000000-0000-0000-0000-000000000001","initial_quantity":100}]'::jsonb
    )
  $test$,
    'P0001',
    null,
    'name longer than 64 characters is rejected with P0001'
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
        proname = 'create_deposit_instance'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'create_deposit_instance is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
