-- pgTAP tests: managed_population_instances_cull_le_count constraint dropped.
-- Verifies that the simulation transition path can transiently set
-- current_count < configured_cull_quantity without a constraint violation,
-- and that set_configured_cull_quantity still rejects quantity > current_count.
-- Run with: npx supabase test db
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all d1-d9 prefixed, unique to this file):
--   d1xxxxxx = users          d2xxxxxx = worlds
--   d3xxxxxx = nations        d4xxxxxx = settlements
--   d5xxxxxx = managed_population_types
--   d6xxxxxx = job_definitions
--   d9xxxxxx = managed_population_instances
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
    'd1000000-0000-0000-0000-100000000001',
    'dcc-admin@example.com',
    'x',
    now(),
    '{"username":"dcc_admin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'd2000000-0000-0000-0000-100000000001',
    'DCC World',
    'd1000000-0000-0000-0000-100000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-100000000001',
    'd2000000-0000-0000-0000-100000000001',
    'DCC Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-100000000001',
    'd3000000-0000-0000-0000-100000000001',
    'DCC Settlement'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'd6000000-0000-0000-0000-100000000001',
    'd2000000-0000-0000-0000-100000000001',
    'DCC Husbandry',
    'dcc-husbandry',
    'husbandry'
  ),
  (
    'd6000000-0000-0000-0000-100000000002',
    'd2000000-0000-0000-0000-100000000001',
    'DCC Culling',
    'dcc-culling',
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
    'd5000000-0000-0000-0000-100000000001',
    'd2000000-0000-0000-0000-100000000001',
    'DCC Cattle',
    'dcc-cattle',
    'd6000000-0000-0000-0000-100000000001',
    'd6000000-0000-0000-0000-100000000002',
    10,
    0.05
  );

-- Instance with current_count=200, configured_cull_quantity=50.
-- The simulation will reduce current_count below configured_cull_quantity
-- transiently before clamping.
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
    'd9000000-0000-0000-0000-100000000001',
    'd4000000-0000-0000-0000-100000000001',
    'd5000000-0000-0000-0000-100000000001',
    'DCC Northern Herd',
    200,
    50,
    'active'
  );

-- ===========================================================================
-- TEST 1: constraint no longer exists
-- The pg_constraint row must be absent.
-- ===========================================================================
select
  is (
    (
      select
        count(*)
      from
        pg_constraint
      where
        conrelid = 'public.managed_population_instances'::regclass
        and conname = 'managed_population_instances_cull_le_count'
    ),
    0::bigint,
    'managed_population_instances_cull_le_count constraint has been dropped'
  );

-- ===========================================================================
-- TEST 2: simulation path — current_count drops below configured_cull_quantity
-- Direct UPDATE as superuser (bypasses RLS), simulating the engine write path.
-- Before this migration this would fail with a CHECK violation.
-- ===========================================================================
select
  lives_ok (
    $$
    update public.managed_population_instances
       set current_count = 10
     where id = 'd9000000-0000-0000-0000-100000000001'
    $$,
    'simulation can set current_count (10) below configured_cull_quantity (50) without constraint violation'
  );

-- ===========================================================================
-- TEST 3: simulation path — engine then clamps configured_cull_quantity
-- After reducing current_count to 10, the engine writes the clamped value.
-- ===========================================================================
select
  lives_ok (
    $$
    update public.managed_population_instances
       set configured_cull_quantity = 10
     where id = 'd9000000-0000-0000-0000-100000000001'
    $$,
    'simulation can subsequently clamp configured_cull_quantity to new current_count'
  );

-- ===========================================================================
-- TEST 4: set_configured_cull_quantity RPC still rejects quantity > current_count
-- current_count is now 10; requesting 11 must raise P0001.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-100000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_configured_cull_quantity(
      'd9000000-0000-0000-0000-100000000001',
      11
    )
    $test$,
    'P0001',
    null,
    'set_configured_cull_quantity still rejects quantity (11) exceeding current_count (10) with P0001'
  );

reset role;

select
  *
from
  finish ();

rollback;
