-- pgTAP tests for public.set_configured_cull_quantity RPC.
-- Run with: npx supabase test db
begin;

select
  plan (6);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all sccq-prefixed, unique to this file):
--   sccq = set_configured_cull_quantity
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = managed_population_types
--   e6xxxxxx = job_definitions
--   e7xxxxxx = citizens
--   e9xxxxxx = managed_population_instances
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
    'e1000000-0000-0000-0000-100000000001',
    'sccq-admin@example.com',
    'x',
    now(),
    '{"username":"sccq_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-100000000002',
    'sccq-manager@example.com',
    'x',
    now(),
    '{"username":"sccq_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-100000000003',
    'sccq-anon@example.com',
    'x',
    now(),
    '{"username":"sccq_anon"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-100000000001',
    'SCCQ World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-100000000001',
    'e1000000-0000-0000-0000-100000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-100000000001',
    'e2000000-0000-0000-0000-100000000001',
    'SCCQ Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-100000000001',
    'e3000000-0000-0000-0000-100000000001',
    'SCCQ Settlement'
  );

-- Settlement manager citizen
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_settlement_id,
    role_nation_id
  )
values
  (
    'e7000000-0000-0000-0000-100000000001',
    'e2000000-0000-0000-0000-100000000001',
    'player_character',
    'SCCQ Manager PC',
    'alive',
    'e1000000-0000-0000-0000-100000000002',
    'settlement_manager',
    'e4000000-0000-0000-0000-100000000001',
    null
  );

-- Job definitions for managed population type FKs
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'e6000000-0000-0000-0000-100000000001',
    'e2000000-0000-0000-0000-100000000001',
    'SCCQ Husbandry',
    'sccq-husbandry',
    'husbandry'
  ),
  (
    'e6000000-0000-0000-0000-100000000002',
    'e2000000-0000-0000-0000-100000000001',
    'SCCQ Culling',
    'sccq-culling',
    'culling'
  );

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
    'e5000000-0000-0000-0000-100000000001',
    'e2000000-0000-0000-0000-100000000001',
    'SCCQ Sheep',
    'sccq-sheep',
    'e6000000-0000-0000-0000-100000000001',
    'e6000000-0000-0000-0000-100000000002',
    10,
    0.05
  );

-- Managed population instance: current_count=100, configured_cull_quantity=0
insert into
  public.managed_population_instances (
    id,
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    configured_cull_quantity,
    status
  )
values
  (
    'e9000000-0000-0000-0000-100000000001',
    'e4000000-0000-0000-0000-100000000001',
    'e5000000-0000-0000-0000-100000000001',
    'SCCQ Northern Herd',
    100,
    0,
    'active'
  );

-- ===========================================================================
-- ADMIN (world owner): success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-100000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_configured_cull_quantity(
      'e9000000-0000-0000-0000-100000000001',
      50
    )
    $test$,
    'world owner (admin) can set configured_cull_quantity'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-100000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_configured_cull_quantity(
      'e9000000-0000-0000-0000-100000000001',
      25
    )
    $test$,
    'settlement manager can set configured_cull_quantity'
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
    select public.set_configured_cull_quantity(
      'e9000000-0000-0000-0000-100000000001',
      10
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- CULL > CURRENT COUNT: rejected (P0001)
-- current_count = 100; quantity = 101
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-100000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_configured_cull_quantity(
      'e9000000-0000-0000-0000-100000000001',
      101
    )
    $test$,
    'P0001',
    null,
    'quantity exceeding current_count is rejected with P0001'
  );

-- ===========================================================================
-- CULL < 0: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_configured_cull_quantity(
      'e9000000-0000-0000-0000-100000000001',
      -1
    )
    $test$,
    'P0001',
    null,
    'negative quantity is rejected with P0001'
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
        proname = 'set_configured_cull_quantity'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_configured_cull_quantity is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
