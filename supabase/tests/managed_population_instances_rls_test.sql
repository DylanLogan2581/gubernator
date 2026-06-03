-- pgTAP tests for public.managed_population_instances RLS, same-world trigger,
-- and check constraints.
-- Run with: npx supabase test db
begin;

select
  plan (15);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   f1xxxxxx = users          f2xxxxxx = worlds
--   f3xxxxxx = nations        f4xxxxxx = settlements
--   f5xxxxxx = job_definitions f6xxxxxx = managed_population_types
--   f7xxxxxx = instances      f8xxxxxx = citizens
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
    'mpi-owner@example.com',
    'x',
    now(),
    '{"username":"mpi_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'mpi-admin@example.com',
    'x',
    now(),
    '{"username":"mpi_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'mpi-outsider@example.com',
    'x',
    now(),
    '{"username":"mpi_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'mpi-super@example.com',
    'x',
    now(),
    '{"username":"mpi_super"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000005',
    'mpi-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"mpi_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000006',
    'mpi-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"mpi_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'MPI Private World',
    'f1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'MPI Outsider World',
    'f1000000-0000-0000-0000-000000000003',
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

-- Husbandry/culling job pairs required by managed_population_types FKs.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'MPI Cattle Husbandry',
    'mpi-cattle-husbandry',
    'husbandry'
  ),
  (
    'f5000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'MPI Cattle Culling',
    'mpi-cattle-culling',
    'culling'
  ),
  (
    'f5000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000002',
    'MPI Outsider Husbandry',
    'mpi-outsider-husbandry',
    'husbandry'
  ),
  (
    'f5000000-0000-0000-0000-000000000004',
    'f2000000-0000-0000-0000-000000000002',
    'MPI Outsider Culling',
    'mpi-outsider-culling',
    'culling'
  );

-- Population type in the primary world (used for most tests).
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
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'MPI Cattle',
    'mpi-cattle',
    'f5000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000002',
    2,
    0.05
  ),
  -- Population type in the outsider world (used for cross-world trigger test).
  (
    'f6000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'MPI Outsider Cattle',
    'mpi-outsider-cattle',
    'f5000000-0000-0000-0000-000000000003',
    'f5000000-0000-0000-0000-000000000004',
    1,
    0.03
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'MPI Nation'
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'MPI Outsider Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'MPI Settlement'
  );

-- Nation manager and settlement manager citizens.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'MPI Nation Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000005',
    'nation_manager',
    'f3000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'f8000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'MPI Settlement Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    'f4000000-0000-0000-0000-000000000001'
  );

-- Seed one instance as postgres so read tests have a visible row.
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
    'f7000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'MPI Cattle Herd',
    100,
    20,
    'active'
  );

-- ===========================================================================
-- ANONYMOUS: cannot read managed_population_instances
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
        public.managed_population_instances
    ),
    0,
    'anon cannot read managed_population_instances'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read instances in an inaccessible private world
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
        public.managed_population_instances mpi
        join public.settlements s on s.id = mpi.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = 'f2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read managed_population_instances in an inaccessible private world'
  );

reset role;

-- ===========================================================================
-- WORLD OWNER: can read instances in their world
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
        public.managed_population_instances
      where
        id = 'f7000000-0000-0000-0000-000000000001'
    ),
    'world owner can read managed_population_instances in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can insert, update, and delete (including extinct status)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.managed_population_instances (
      id, settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f7000000-0000-0000-0000-000000000010',
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Admin Cattle Herd',
      50, 10, 'active'
    )
  $test$,
    'world admin can insert a managed_population_instance'
  );

select
  lives_ok (
    $test$
    update public.managed_population_instances
    set configured_cull_quantity = 5
    where id = 'f7000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update a managed_population_instance'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_instances
    where id = 'f7000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can delete a managed_population_instance'
  );

-- Admin can insert with status='extinct' (Card 18 path).
select
  lives_ok (
    $test$
    insert into public.managed_population_instances (
      id, settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f7000000-0000-0000-0000-000000000011',
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Admin Extinct Herd',
      0, 0, 'extinct'
    )
  $test$,
    'world admin can insert a managed_population_instance with status=extinct'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can insert instances in any world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.managed_population_instances (
      id, settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f7000000-0000-0000-0000-000000000012',
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Super Cattle Herd',
      200, 0, 'active'
    )
  $test$,
    'super admin can insert a managed_population_instance'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: can insert with status='active'
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.managed_population_instances (
      id, settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f7000000-0000-0000-0000-000000000013',
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Nation Mgr Cattle Herd',
      75, 15, 'active'
    )
  $test$,
    'nation manager can insert a managed_population_instance with status=active'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: can insert with status='active' and update cull quantity
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.managed_population_instances (
      id, settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f7000000-0000-0000-0000-000000000014',
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Settlement Mgr Cattle Herd',
      60, 10, 'active'
    )
  $test$,
    'settlement manager can insert a managed_population_instance with status=active'
  );

select
  lives_ok (
    $test$
    update public.managed_population_instances
    set configured_cull_quantity = 5
    where id = 'f7000000-0000-0000-0000-000000000014'
  $test$,
    'settlement manager can update configured_cull_quantity'
  );

reset role;

-- ===========================================================================
-- MANAGER: cannot insert with status='extinct'
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.managed_population_instances (
      settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Mgr Extinct Attempt',
      0, 0, 'extinct'
    )
  $test$,
    '42501',
    null,
    'settlement manager cannot insert a managed_population_instance with status=extinct'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD: type from outsider world rejected by same-world trigger
-- ===========================================================================
-- Run as postgres to isolate the trigger (not RLS).
select
  throws_ok (
    $test$
    insert into public.managed_population_instances (
      settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000002',
      'Cross World Herd',
      50, 0, 'active'
    )
  $test$,
    '23503',
    null,
    'managed_population_type from a different world is rejected by the same-world trigger'
  );

-- ===========================================================================
-- CONSTRAINT: current_count = -1 is rejected
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.managed_population_instances (
      settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Negative Count Herd',
      -1, 0, 'active'
    )
  $test$,
    '23514',
    null,
    'current_count = -1 is rejected by the check constraint'
  );

-- ===========================================================================
-- CONSTRAINT DROPPED: configured_cull_quantity > current_count is now allowed
-- at the table level; enforcement is via set_configured_cull_quantity RPC and
-- client-side validation only (constraint dropped in 20260602000005).
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.managed_population_instances (
      settlement_id, managed_population_type_id,
      name, current_count, configured_cull_quantity, status
    )
    values (
      'f4000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'Excess Cull Herd',
      50, 51, 'active'
    )
  $test$,
    'configured_cull_quantity > current_count is now permitted at the table level (cull_le_count constraint dropped)'
  );

select
  *
from
  finish ();

rollback;
