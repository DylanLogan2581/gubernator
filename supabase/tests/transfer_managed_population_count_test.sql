-- pgTAP tests for public.transfer_managed_population_count RPC.
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all fc-prefixed, unique to this file):
--   fc1xxxxx = users          fc2xxxxx = worlds
--   fc3xxxxx = nations        fc4xxxxx = settlements (fc4...02 = other settlement)
--   fc5xxxxx = managed_population_types (fc5...02 = other type)
--   fc7xxxxx = citizens
--   fc8xxxxx = managed_population_instances
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
    'fc100000-0000-0000-0000-000000000001',
    'tmpc-owner@example.com',
    'x',
    now(),
    '{"username":"tmpc_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'fc100000-0000-0000-0000-000000000002',
    'tmpc-manager@example.com',
    'x',
    now(),
    '{"username":"tmpc_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'fc200000-0000-0000-0000-000000000001',
    'TMPC World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'fc200000-0000-0000-0000-000000000001',
    'fc100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'fc300000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'TMPC Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fc400000-0000-0000-0000-000000000001',
    'fc300000-0000-0000-0000-000000000001',
    'TMPC Settlement'
  ),
  (
    'fc400000-0000-0000-0000-000000000002',
    'fc300000-0000-0000-0000-000000000001',
    'TMPC Other Settlement'
  );

-- Settlement manager player character (manages settlement 1 only)
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
    'fc700000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'player_character',
    'TMPC Manager PC',
    'alive',
    'fc100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'fc400000-0000-0000-0000-000000000001',
    null
  );

insert into
  public.managed_population_types (id, world_id, name, slug, growth_rate)
values
  (
    'fc500000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'TMPC Sheep',
    'tmpc-sheep',
    0.05
  ),
  (
    'fc500000-0000-0000-0000-000000000002',
    'fc200000-0000-0000-0000-000000000001',
    'TMPC Goats',
    'tmpc-goats',
    0.05
  );

-- Managed population instances:
--   fc8...0001 – source herd, settlement 1, sheep, count 100
--   fc8...0002 – target herd, settlement 1, sheep, count 50
--   fc8...0003 – different type (goats), settlement 1
--   fc8...0004 – different settlement, sheep
--   fc8...0005 – extinct herd, settlement 1, sheep
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
    'fc800000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'fc500000-0000-0000-0000-000000000001',
    'TMPC Herd Source',
    100,
    0,
    'active'
  ),
  (
    'fc800000-0000-0000-0000-000000000002',
    'fc400000-0000-0000-0000-000000000001',
    'fc500000-0000-0000-0000-000000000001',
    'TMPC Herd Target',
    50,
    0,
    'active'
  ),
  (
    'fc800000-0000-0000-0000-000000000003',
    'fc400000-0000-0000-0000-000000000001',
    'fc500000-0000-0000-0000-000000000002',
    'TMPC Herd Other Type',
    20,
    0,
    'active'
  ),
  (
    'fc800000-0000-0000-0000-000000000004',
    'fc400000-0000-0000-0000-000000000002',
    'fc500000-0000-0000-0000-000000000001',
    'TMPC Herd Other Settlement',
    20,
    0,
    'active'
  ),
  (
    'fc800000-0000-0000-0000-000000000005',
    'fc400000-0000-0000-0000-000000000001',
    'fc500000-0000-0000-0000-000000000001',
    'TMPC Herd Extinct',
    0,
    0,
    'extinct'
  );

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
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000002', 10)
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- UNAUTHORIZED SETTLEMENT MANAGER: rejected (42501)
-- Manager only manages settlement 1's PC, but tries a transfer sourced from
-- settlement 2 (which they do not manage).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000004', 'fc800000-0000-0000-0000-000000000002', 5)
    $test$,
    '42501',
    null,
    'settlement manager without access to source settlement is rejected with 42501'
  );

-- ===========================================================================
-- CROSS-TYPE: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000003', 5)
    $test$,
    'P0001',
    null,
    'cross-type transfer is rejected with P0001'
  );

-- ===========================================================================
-- CROSS-SETTLEMENT: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000004', 5)
    $test$,
    'P0001',
    null,
    'cross-settlement transfer is rejected with P0001'
  );

-- ===========================================================================
-- EXTINCT TARGET: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000005', 5)
    $test$,
    'P0001',
    null,
    'transfer into an extinct instance is rejected with P0001'
  );

-- ===========================================================================
-- OVERDRAWN: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000002', 1000)
    $test$,
    'P0001',
    null,
    'transfer exceeding source current_count is rejected with P0001'
  );

-- ===========================================================================
-- NON-POSITIVE COUNT: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000002', 0)
    $test$,
    'P0001',
    null,
    'zero transfer count is rejected with P0001'
  );

-- ===========================================================================
-- SAME INSTANCE: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000001', 5)
    $test$,
    'P0001',
    null,
    'transfer to the same instance is rejected with P0001'
  );

-- ===========================================================================
-- MANAGER SUCCESS: settlement manager transfers within their settlement
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.transfer_managed_population_count('fc800000-0000-0000-0000-000000000001', 'fc800000-0000-0000-0000-000000000002', 30)
    $test$,
    'settlement manager can transfer headcount between same-type instances in their settlement'
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'fc800000-0000-0000-0000-000000000001'
    ),
    70::numeric,
    'source current_count decremented by transfer amount'
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'fc800000-0000-0000-0000-000000000002'
    ),
    80::numeric,
    'target current_count incremented by transfer amount'
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
        proname = 'transfer_managed_population_count'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'transfer_managed_population_count is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
