-- pgTAP tests for public.set_deposit_instance_resource_quantities RPC.
-- Run with: npx supabase test db
begin;

select
  plan (15);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all f1-prefixed, unique to this file):
--   f1000000 = users          f2000000 = worlds
--   f3000000 = nations        f4000000 = settlements
--   f5000000 = deposit_types  f6000000 = resources
--   f7000000 = citizens       f8000000 = job_definitions
--   f9000000 = deposit_instances  fa000000 = deposit_instance_resources
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
    'sdirq-owner@example.com',
    'x',
    now(),
    '{"username":"sdirq_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'sdirq-manager@example.com',
    'x',
    now(),
    '{"username":"sdirq_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'sdirq-anon@example.com',
    'x',
    now(),
    '{"username":"sdirq_anon"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'SDIRQ World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'SDIRQ Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'SDIRQ Settlement'
  );

-- Settlement manager (non-admin) player character
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
    'f7000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'SDIRQ Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000002',
    'settlement_manager',
    'f4000000-0000-0000-0000-000000000001',
    null
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'SDIRQ Mining',
    'sdirq-mining',
    'deposit'
  );

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
    'SDIRQ Iron Seam',
    'sdirq-iron-seam',
    'f8000000-0000-0000-0000-000000000001',
    10
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'SDIRQ Iron Ore',
    'sdirq-iron-ore'
  );

insert into
  public.deposit_instances (
    id,
    settlement_id,
    deposit_type_id,
    name,
    status,
    max_workers
  )
values
  (
    'f9000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'SDIRQ Iron Alpha',
    'active',
    null
  );

insert into
  public.deposit_instance_resources (
    id,
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    'fa000000-0000-0000-0000-000000000001',
    'f9000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    1000,
    750
  );

-- ===========================================================================
-- WORLD OWNER (implicit world admin): success — edit both values
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        row_to_json(t)::jsonb
      from
        public.set_deposit_instance_resource_quantities ('fa000000-0000-0000-0000-000000000001', 1200, 900) t
    ),
    jsonb_build_object(
      'deposit_instance_resource_id',
      'fa000000-0000-0000-0000-000000000001'::uuid,
      'deposit_instance_id',
      'f9000000-0000-0000-0000-000000000001'::uuid,
      'settlement_id',
      'f4000000-0000-0000-0000-000000000001'::uuid,
      'initial_quantity',
      1200,
      'remaining_quantity',
      900
    ),
    'world owner can set initial and remaining quantities'
  );

-- Verify the row was actually updated
select
  is (
    (
      select
        jsonb_build_object(
          'initial_quantity',
          dir.initial_quantity,
          'remaining_quantity',
          dir.remaining_quantity
        )
      from
        public.deposit_instance_resources dir
      where
        dir.id = 'fa000000-0000-0000-0000-000000000001'
    ),
    '{"initial_quantity":1200,"remaining_quantity":900}'::jsonb,
    'row reflects updated quantities after successful call'
  );

reset role;

-- ===========================================================================
-- remaining = initial (boundary): allowed
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      500,
      500
    )
    $test$,
    'remaining = initial is allowed'
  );

-- ===========================================================================
-- remaining = 0: allowed
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      500,
      0
    )
    $test$,
    'remaining = 0 is allowed'
  );

reset role;

-- ===========================================================================
-- remaining > initial: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      100,
      200
    )
    $test$,
    'P0001',
    null,
    'remaining > initial is rejected with P0001'
  );

-- ===========================================================================
-- initial < 0: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      -1,
      0
    )
    $test$,
    'P0001',
    null,
    'initial_quantity < 0 is rejected with P0001'
  );

-- ===========================================================================
-- remaining < 0: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      100,
      -1
    )
    $test$,
    'P0001',
    null,
    'remaining_quantity < 0 is rejected with P0001'
  );

-- ===========================================================================
-- initial = 0: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      0,
      0
    )
    $test$,
    'P0001',
    null,
    'initial_quantity = 0 is rejected with P0001'
  );

-- ===========================================================================
-- p_initial_quantity is NULL: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      null,
      0
    )
    $test$,
    'P0001',
    null,
    'null initial_quantity is rejected with P0001'
  );

-- ===========================================================================
-- p_remaining_quantity is NULL: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      100,
      null
    )
    $test$,
    'P0001',
    null,
    'null remaining_quantity is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER (non-admin): rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      1000,
      500
    )
    $test$,
    '42501',
    null,
    'settlement manager (non-admin) is rejected with 42501'
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
    select public.set_deposit_instance_resource_quantities(
      'fa000000-0000-0000-0000-000000000001',
      1000,
      500
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- NULL resource id: rejected (P0002)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      null,
      1000,
      500
    )
    $test$,
    'P0002',
    null,
    'null resource id is rejected with P0002'
  );

-- ===========================================================================
-- UNKNOWN resource id: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      1000,
      500
    )
    $test$,
    'P0002',
    null,
    'unknown resource id is rejected with P0002'
  );

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
        proname = 'set_deposit_instance_resource_quantities'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_deposit_instance_resource_quantities is SECURITY DEFINER'
  );

reset role;

select
  *
from
  finish ();

rollback;
