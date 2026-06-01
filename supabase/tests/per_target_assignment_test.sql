-- pgTAP tests for public.set_per_target_assignment RPC.
-- Run with: npx supabase test db
begin;

select
  plan (22);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all fe-prefixed, unique to this file):
--   fe1xxxxx = users          fe2xxxxx = worlds
--   fe3xxxxx = nations        fe4xxxxx = settlements
--   fe5xxxxx = resources      fe6xxxxx = job_definitions
--   fe7xxxxx = deposit_types  fe8xxxxx = managed_population_types
--   fe9xxxxx = deposit_instances / managed_population_instances
--   feaxxxxx = trade_routes   febxxxxx = citizens
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
    'fe100000-0000-0000-0000-000000000001',
    'fepta-owner@example.com',
    'x',
    now(),
    '{"username":"fepta_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'fe100000-0000-0000-0000-000000000002',
    'fepta-manager@example.com',
    'x',
    now(),
    '{"username":"fepta_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'fe100000-0000-0000-0000-000000000003',
    'fepta-outsider@example.com',
    'x',
    now(),
    '{"username":"fepta_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'fe100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA World',
    'fe100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'fe300000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Nation'
  );

-- Two settlements: 001 = main, 002 = other (for wrong-settlement and trade-route tests)
insert into
  public.settlements (id, nation_id, name)
values
  (
    'fe400000-0000-0000-0000-000000000001',
    'fe300000-0000-0000-0000-000000000001',
    'FEPTA Settlement 1'
  ),
  (
    'fe400000-0000-0000-0000-000000000002',
    'fe300000-0000-0000-0000-000000000001',
    'FEPTA Settlement 2'
  );

-- Resource (required by trade_routes)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'fe500000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Resource',
    'fepta-resource'
  );

-- job_definitions:
--   fe6...001 = deposit job (active)
--   fe6...002 = husbandry job for mpt1 (active)
--   fe6...003 = culling job for mpt1 (active)
--   fe6...004 = husbandry job for mpt2 (will be trashed after mpt insert)
--   fe6...005 = culling job for mpt2 (will be trashed after mpt insert)
insert into
  public.job_definitions (id, world_id, name, slug, job_type, is_trashed)
values
  (
    'fe600000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Deposit Job',
    'fepta-deposit-job',
    'deposit',
    false
  ),
  (
    'fe600000-0000-0000-0000-000000000002',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Husbandry Job',
    'fepta-husbandry-job',
    'husbandry',
    false
  ),
  (
    'fe600000-0000-0000-0000-000000000003',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Culling Job',
    'fepta-culling-job',
    'culling',
    false
  ),
  (
    'fe600000-0000-0000-0000-000000000004',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Husbandry Job Trashed',
    'fepta-husbandry-job-trashed',
    'husbandry',
    false
  ),
  (
    'fe600000-0000-0000-0000-000000000005',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Culling Job Trashed',
    'fepta-culling-job-trashed',
    'culling',
    false
  );

-- deposit_types: fe7...001 = active deposit type (job = fe6...001)
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
    'fe700000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Ore',
    'fepta-ore',
    'fe600000-0000-0000-0000-000000000001',
    5,
    false
  );

-- managed_population_types:
--   fe8...001 = active type with active jobs
--   fe8...002 = active type with jobs that will be trashed
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    is_trashed
  )
values
  (
    'fe800000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Cattle',
    'fepta-cattle',
    'fe600000-0000-0000-0000-000000000002',
    'fe600000-0000-0000-0000-000000000003',
    10,
    false
  ),
  (
    'fe800000-0000-0000-0000-000000000002',
    'fe200000-0000-0000-0000-000000000001',
    'FEPTA Pigs',
    'fepta-pigs',
    'fe600000-0000-0000-0000-000000000004',
    'fe600000-0000-0000-0000-000000000005',
    10,
    false
  );

-- Now trash the two jobs used by mpt2
update public.job_definitions
set
  is_trashed = true
where
  id in (
    'fe600000-0000-0000-0000-000000000004',
    'fe600000-0000-0000-0000-000000000005'
  );

-- deposit_instances:
--   fe9...001 = active, settlement1, no max_workers
--   fe9...002 = depleted, settlement1
--   fe9...003 = active, settlement2 (wrong settlement)
--   fe9...004 = active, settlement1, max_workers = 1
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
    'fe900000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'fe700000-0000-0000-0000-000000000001',
    'FEPTA Active Mine',
    'active',
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000002',
    'fe400000-0000-0000-0000-000000000001',
    'fe700000-0000-0000-0000-000000000001',
    'FEPTA Depleted Mine',
    'depleted',
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000003',
    'fe400000-0000-0000-0000-000000000002',
    'fe700000-0000-0000-0000-000000000001',
    'FEPTA Other Mine',
    'active',
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000004',
    'fe400000-0000-0000-0000-000000000001',
    'fe700000-0000-0000-0000-000000000001',
    'FEPTA Tiny Mine',
    'active',
    1
  );

-- managed_population_instances:
--   fe9...005 = active, settlement1, mpt1 (good jobs)
--   fe9...006 = active, settlement1, mpt2 (trashed jobs)
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
    'fe900000-0000-0000-0000-000000000005',
    'fe400000-0000-0000-0000-000000000001',
    'fe800000-0000-0000-0000-000000000001',
    'FEPTA Cattle Herd',
    100,
    0,
    'active'
  ),
  (
    'fe900000-0000-0000-0000-000000000006',
    'fe400000-0000-0000-0000-000000000001',
    'fe800000-0000-0000-0000-000000000002',
    'FEPTA Pig Pen',
    50,
    0,
    'active'
  );

-- Citizens:
--   feb...001-003 = NPCs, alive, settlement1
--   feb...004 = PC settlement manager (linked to user fe1...002)
--   feb...005 = NPC, dead, settlement1
--   feb...006 = NPC, alive, settlement2 (wrong settlement)
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_settlement_id
  )
values
  (
    'feb00000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'FEPTA NPC 1',
    'alive',
    null,
    'none',
    null
  ),
  (
    'feb00000-0000-0000-0000-000000000002',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'FEPTA NPC 2',
    'alive',
    null,
    'none',
    null
  ),
  (
    'feb00000-0000-0000-0000-000000000003',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'FEPTA NPC 3',
    'alive',
    null,
    'none',
    null
  ),
  (
    'feb00000-0000-0000-0000-000000000004',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'player_character',
    'FEPTA PC Manager',
    'alive',
    'fe100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'fe400000-0000-0000-0000-000000000001'
  ),
  (
    'feb00000-0000-0000-0000-000000000005',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'FEPTA NPC Dead',
    'dead',
    null,
    'none',
    null
  ),
  (
    'feb00000-0000-0000-0000-000000000006',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000002',
    'npc',
    'FEPTA NPC Other Settlement',
    'alive',
    null,
    'none',
    null
  );

-- trade_routes:
--   fea...001 = active, origin=settlement1, dest=settlement2
--   fea...002 = proposed (inactive), origin=settlement1, dest=settlement2
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'fea00000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000002',
    'fe500000-0000-0000-0000-000000000001',
    10,
    'active',
    'feb00000-0000-0000-0000-000000000001',
    'approved',
    'approved'
  ),
  (
    'fea00000-0000-0000-0000-000000000002',
    'fe400000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000002',
    'fe500000-0000-0000-0000-000000000001',
    5,
    'proposed',
    'feb00000-0000-0000-0000-000000000001',
    'pending',
    'pending'
  );

-- ===========================================================================
-- SECURITY DEFINER check
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'set_per_target_assignment'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_per_target_assignment is SECURITY DEFINER'
  );

-- ===========================================================================
-- SUPER ADMIN: deposit assignment (NPCs 001 + 002)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fe100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.assigned_count
      from
        public.set_per_target_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'deposit',
          'fe900000-0000-0000-0000-000000000001',
          array[
            'feb00000-0000-0000-0000-000000000001'::uuid,
            'feb00000-0000-0000-0000-000000000002'::uuid
          ]
        ) r
    ),
    2,
    'super admin: deposit assignment returns assigned_count = 2'
  );

select
  is (
    (
      select
        r.replaced_count
      from
        public.set_per_target_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'deposit',
          'fe900000-0000-0000-0000-000000000001',
          array[
            'feb00000-0000-0000-0000-000000000001'::uuid,
            'feb00000-0000-0000-0000-000000000002'::uuid
          ]
        ) r
    ),
    2,
    'super admin: re-assigning same citizens returns replaced_count = 2'
  );

reset role;

-- Verify rows in citizen_assignments
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.assignment_type = 'deposit'
        and ca.deposit_instance_id = 'fe900000-0000-0000-0000-000000000001'
    ),
    2,
    'deposit: two rows in citizen_assignments'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: husbandry assignment
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fe100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'husbandry',
      'fe900000-0000-0000-0000-000000000005',
      array['feb00000-0000-0000-0000-000000000003'::uuid]
    )
    $test$,
    'settlement manager can assign husbandry'
  );

-- ===========================================================================
-- REJECTION: outsider (authenticated, no settlement access)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"fe100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000001',
      array['feb00000-0000-0000-0000-000000000001'::uuid]
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: null p_settlement_id
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fe100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      null,
      'deposit',
      'fe900000-0000-0000-0000-000000000001',
      array['feb00000-0000-0000-0000-000000000001'::uuid]
    )
    $test$,
    'P0002',
    null,
    'null settlement_id raises P0002'
  );

-- ===========================================================================
-- REJECTION: null p_citizen_ids
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000001',
      null
    )
    $test$,
    'P0002',
    null,
    'null citizen_ids raises P0002'
  );

-- ===========================================================================
-- REJECTION: unknown assignment_type
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'construction_project',
      'fe900000-0000-0000-0000-000000000001',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'unknown assignment_type raises P0001'
  );

-- ===========================================================================
-- REJECTION: deposit instance in wrong settlement
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000003',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'deposit instance in wrong settlement raises P0001'
  );

-- ===========================================================================
-- REJECTION: deposit instance not active (depleted)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000002',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'depleted deposit instance raises P0001'
  );

-- ===========================================================================
-- REJECTION: deposit exceeds max_workers (max=1, trying 2)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000004',
      array[
        'feb00000-0000-0000-0000-000000000001'::uuid,
        'feb00000-0000-0000-0000-000000000002'::uuid
      ]
    )
    $test$,
    'P0001',
    null,
    'exceeding max_workers raises P0001'
  );

-- ===========================================================================
-- REJECTION: husbandry with trashed job
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'husbandry',
      'fe900000-0000-0000-0000-000000000006',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'husbandry with trashed job raises P0001'
  );

-- ===========================================================================
-- REJECTION: culling with trashed job
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'culling',
      'fe900000-0000-0000-0000-000000000006',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'culling with trashed job raises P0001'
  );

-- ===========================================================================
-- REJECTION: trade_route without trade_route_end
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'trade_route',
      'fea00000-0000-0000-0000-000000000001',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'trade_route without trade_route_end raises P0001'
  );

-- ===========================================================================
-- REJECTION: trade_route with wrong end (destination instead of origin)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'trade_route',
      'fea00000-0000-0000-0000-000000000001',
      array[]::uuid[],
      'destination'
    )
    $test$,
    'P0001',
    null,
    'trade_route with mismatched end raises P0001'
  );

-- ===========================================================================
-- REJECTION: trade_route not active (proposed)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'trade_route',
      'fea00000-0000-0000-0000-000000000002',
      array[]::uuid[],
      'origin'
    )
    $test$,
    'P0001',
    null,
    'proposed trade route raises P0001'
  );

-- ===========================================================================
-- REJECTION: citizen not alive
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000001',
      array['feb00000-0000-0000-0000-000000000005'::uuid]
    )
    $test$,
    'P0001',
    null,
    'dead citizen raises P0001'
  );

-- ===========================================================================
-- REJECTION: citizen not in settlement
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fe400000-0000-0000-0000-000000000001',
      'deposit',
      'fe900000-0000-0000-0000-000000000001',
      array['feb00000-0000-0000-0000-000000000006'::uuid]
    )
    $test$,
    'P0001',
    null,
    'citizen in wrong settlement raises P0001'
  );

-- ===========================================================================
-- CLEAR: empty citizen list removes all deposit assignments
-- After the earlier tests, NPCs 001+002 are assigned to deposit fe9...001.
-- NPC 003 is assigned to husbandry fe9...005 (from manager test above).
-- Clear the deposit target with empty list.
-- ===========================================================================
select
  is (
    (
      select
        r.assigned_count
      from
        public.set_per_target_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'deposit',
          'fe900000-0000-0000-0000-000000000001',
          array[]::uuid[]
        ) r
    ),
    0,
    'empty citizen list: assigned_count = 0'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.assignment_type = 'deposit'
        and ca.deposit_instance_id = 'fe900000-0000-0000-0000-000000000001'
    ),
    0,
    'empty citizen list: deposit target has no assignments'
  );

-- ===========================================================================
-- REPLACED COUNT: assign NPC 003 (currently at husbandry) to deposit
-- NPC 003 was assigned to husbandry in the manager test.
-- Assigning NPC 003 to deposit should produce replaced_count = 1
-- (NPC 003's husbandry assignment is deleted before the new insert).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fe100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.replaced_count
      from
        public.set_per_target_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'deposit',
          'fe900000-0000-0000-0000-000000000001',
          array['feb00000-0000-0000-0000-000000000003'::uuid]
        ) r
    ),
    1,
    'replaced_count = 1 when moving a citizen from another target'
  );

reset role;

select
  *
from
  finish ();

rollback;
