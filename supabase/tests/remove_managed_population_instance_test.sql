-- pgTAP tests for public.remove_managed_population_instance RPC.
-- Run with: npx supabase test db
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all fb-prefixed, unique to this file):
--   fb1xxxxx = users          fb2xxxxx = worlds
--   fb3xxxxx = nations        fb4xxxxx = settlements
--   fb5xxxxx = managed_population_types
--   fb6xxxxx = job_definitions fb7xxxxx = citizens
--   fb8xxxxx = managed_population_instances
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
    'fb100000-0000-0000-0000-000000000001',
    'rmpi-owner@example.com',
    'x',
    now(),
    '{"username":"rmpi_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'fb100000-0000-0000-0000-000000000002',
    'rmpi-manager@example.com',
    'x',
    now(),
    '{"username":"rmpi_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'fb200000-0000-0000-0000-000000000001',
    'RMPI World',
    'fb100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'fb300000-0000-0000-0000-000000000001',
    'fb200000-0000-0000-0000-000000000001',
    'RMPI Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fb400000-0000-0000-0000-000000000001',
    'fb300000-0000-0000-0000-000000000001',
    'RMPI Settlement'
  );

-- Settlement manager player character
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
    'fb700000-0000-0000-0000-000000000001',
    'fb200000-0000-0000-0000-000000000001',
    'player_character',
    'RMPI Manager PC',
    'alive',
    'fb100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'fb400000-0000-0000-0000-000000000001',
    null
  );

-- NPC worker for assignment tests
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    role_type
  )
values
  (
    'fb700000-0000-0000-0000-000000000002',
    'fb200000-0000-0000-0000-000000000001',
    'npc',
    'RMPI Worker NPC',
    'alive',
    'none'
  );

-- Job definitions needed for managed population type FKs
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'fb600000-0000-0000-0000-000000000001',
    'fb200000-0000-0000-0000-000000000001',
    'RMPI Husbandry',
    'rmpi-husbandry',
    'husbandry'
  ),
  (
    'fb600000-0000-0000-0000-000000000002',
    'fb200000-0000-0000-0000-000000000001',
    'RMPI Culling',
    'rmpi-culling',
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
    'fb500000-0000-0000-0000-000000000001',
    'fb200000-0000-0000-0000-000000000001',
    'RMPI Sheep',
    'rmpi-sheep',
    'fb600000-0000-0000-0000-000000000001',
    'fb600000-0000-0000-0000-000000000002',
    10,
    0.05
  );

-- Managed population instances:
--   fb8...0001 – used for manager rejected, anon rejected, admin success tests
--   fb8...0002 – has an active assignment; used for blocked and success-after-unassign tests
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
    'fb800000-0000-0000-0000-000000000001',
    'fb400000-0000-0000-0000-000000000001',
    'fb500000-0000-0000-0000-000000000001',
    'RMPI Herd Alpha',
    100,
    0,
    'active'
  ),
  (
    'fb800000-0000-0000-0000-000000000002',
    'fb400000-0000-0000-0000-000000000001',
    'fb500000-0000-0000-0000-000000000001',
    'RMPI Herd Beta',
    50,
    0,
    'active'
  );

-- Assign the NPC worker to fb8...0002
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    managed_population_instance_id,
    assigned_on_turn_number
  )
values
  (
    'fb700000-0000-0000-0000-000000000002',
    'husbandry',
    'fb800000-0000-0000-0000-000000000002',
    1
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: rejected (42501)
-- Settlement managers are not world admins and cannot retire an instance.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fb100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.remove_managed_population_instance('fb800000-0000-0000-0000-000000000001')
    $test$,
    '42501',
    null,
    'settlement manager is rejected with 42501'
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
    select public.remove_managed_population_instance('fb800000-0000-0000-0000-000000000001')
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- BLOCKED WITH ACTIVE ASSIGNMENTS: rejected (P0001)
-- fb8...0002 has one NPC worker assigned via husbandry.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fb100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.remove_managed_population_instance('fb800000-0000-0000-0000-000000000002')
    $test$,
    'P0001',
    null,
    'admin blocked with P0001 when active assignments exist'
  );

-- ===========================================================================
-- SUCCESS AFTER UNASSIGN: admin removes instance once workers are cleared
-- ===========================================================================
delete from public.citizen_assignments ca
where
  ca.citizen_id = 'fb700000-0000-0000-0000-000000000002';

select
  lives_ok (
    $test$
    select public.remove_managed_population_instance('fb800000-0000-0000-0000-000000000002')
    $test$,
    'admin can remove managed population instance after assignments are cleared'
  );

select
  is (
    (
      select
        mpi.status
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'fb800000-0000-0000-0000-000000000002'
    ),
    'extinct',
    'managed population instance status is extinct after successful removal'
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'fb800000-0000-0000-0000-000000000002'
    ),
    0::numeric,
    'managed population instance current_count is 0 after successful removal'
  );

-- ===========================================================================
-- ADMIN SUCCESS: world owner can remove an active instance
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.remove_managed_population_instance('fb800000-0000-0000-0000-000000000001')
    $test$,
    'world owner can remove an active managed population instance'
  );

select
  is (
    (
      select
        mpi.status
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'fb800000-0000-0000-0000-000000000001'
    ),
    'extinct',
    'managed population instance status is extinct after admin success'
  );

select
  is (
    (
      select
        mpi.current_count
      from
        public.managed_population_instances mpi
      where
        mpi.id = 'fb800000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'managed population instance current_count is 0 after admin success'
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
        proname = 'remove_managed_population_instance'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'remove_managed_population_instance is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
