-- pgTAP tests for public.set_per_target_bulk_assignment RPC.
-- Run with: npx supabase test db
begin;

select
  plan (28);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ff-prefixed, unique to this file):
--   ff1xxxxx = users          ff2xxxxx = worlds
--   ff3xxxxx = nations        ff4xxxxx = settlements
--   ff5xxxxx = resources      ff6xxxxx = job_definitions
--   ff7xxxxx = deposit_types  ff8xxxxx = managed_population_types
--   ff9xxxxx = deposit_instances / managed_population_instances
--   ffaxxxxx = trade_routes   ffbxxxxx = citizens
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
    'ff100000-0000-0000-0000-000000000001',
    'ffptb-owner@example.com',
    'x',
    now(),
    '{"username":"ffptb_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ff100000-0000-0000-0000-000000000002',
    'ffptb-manager@example.com',
    'x',
    now(),
    '{"username":"ffptb_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'ff100000-0000-0000-0000-000000000003',
    'ffptb-outsider@example.com',
    'x',
    now(),
    '{"username":"ffptb_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'ff100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB World',
    'ff100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ff300000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ff400000-0000-0000-0000-000000000001',
    'ff300000-0000-0000-0000-000000000001',
    'FFPTB Settlement 1'
  ),
  (
    'ff400000-0000-0000-0000-000000000002',
    'ff300000-0000-0000-0000-000000000001',
    'FFPTB Settlement 2'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ff500000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Resource',
    'ffptb-resource'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type, is_trashed)
values
  (
    'ff600000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Deposit Job',
    'ffptb-deposit-job',
    'deposit',
    false
  ),
  (
    'ff600000-0000-0000-0000-000000000002',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Husbandry Job',
    'ffptb-husbandry-job',
    'husbandry',
    false
  ),
  (
    'ff600000-0000-0000-0000-000000000003',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Culling Job',
    'ffptb-culling-job',
    'culling',
    false
  ),
  (
    'ff600000-0000-0000-0000-000000000004',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Husbandry Trashed',
    'ffptb-husbandry-trashed',
    'husbandry',
    false
  ),
  (
    'ff600000-0000-0000-0000-000000000005',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Culling Trashed',
    'ffptb-culling-trashed',
    'culling',
    false
  );

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
    'ff700000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Ore',
    'ffptb-ore',
    'ff600000-0000-0000-0000-000000000001',
    5,
    false
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
    is_trashed
  )
values
  (
    'ff800000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Cattle',
    'ffptb-cattle',
    'ff600000-0000-0000-0000-000000000002',
    'ff600000-0000-0000-0000-000000000003',
    10,
    false
  ),
  (
    'ff800000-0000-0000-0000-000000000002',
    'ff200000-0000-0000-0000-000000000001',
    'FFPTB Pigs',
    'ffptb-pigs',
    'ff600000-0000-0000-0000-000000000004',
    'ff600000-0000-0000-0000-000000000005',
    10,
    false
  );

update public.job_definitions
set
  is_trashed = true
where
  id in (
    'ff600000-0000-0000-0000-000000000004',
    'ff600000-0000-0000-0000-000000000005'
  );

-- deposit_instances:
--   ff9...001 = active, settlement1, no max_workers
--   ff9...002 = depleted, settlement1
--   ff9...003 = active, settlement1, max_workers = 2
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
    'ff900000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'ff700000-0000-0000-0000-000000000001',
    'FFPTB Active Mine',
    'active',
    null
  ),
  (
    'ff900000-0000-0000-0000-000000000002',
    'ff400000-0000-0000-0000-000000000001',
    'ff700000-0000-0000-0000-000000000001',
    'FFPTB Depleted Mine',
    'depleted',
    null
  ),
  (
    'ff900000-0000-0000-0000-000000000003',
    'ff400000-0000-0000-0000-000000000001',
    'ff700000-0000-0000-0000-000000000001',
    'FFPTB Capped Mine',
    'active',
    2
  );

-- managed_population_instances:
--   ff9...004 = active, settlement1, good jobs
--   ff9...005 = active, settlement1, trashed jobs
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
    'ff900000-0000-0000-0000-000000000004',
    'ff400000-0000-0000-0000-000000000001',
    'ff800000-0000-0000-0000-000000000001',
    'FFPTB Cattle Herd',
    100,
    0,
    'active'
  ),
  (
    'ff900000-0000-0000-0000-000000000005',
    'ff400000-0000-0000-0000-000000000001',
    'ff800000-0000-0000-0000-000000000002',
    'FFPTB Pig Pen',
    50,
    0,
    'active'
  );

-- Citizens:
--   ffb...001-003 = NPCs, alive, settlement1 (3 unassigned)
--   ffb...004 = PC settlement manager, settlement1
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
    role_settlement_id,
    death_cause_category
  )
values
  (
    'ffb00000-0000-0000-0000-000000000001',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'npc',
    'FFPTB NPC 1',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'ffb00000-0000-0000-0000-000000000002',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'npc',
    'FFPTB NPC 2',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'ffb00000-0000-0000-0000-000000000003',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'npc',
    'FFPTB NPC 3',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'ffb00000-0000-0000-0000-000000000004',
    'ff200000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'player_character',
    'FFPTB PC Manager',
    'alive',
    'ff100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'ff400000-0000-0000-0000-000000000001',
    null
  );

-- trade_routes:
--   ffa...001 = active, origin=settlement1, dest=settlement2
--   ffa...002 = proposed (inactive)
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
    'ffa00000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000002',
    'ff500000-0000-0000-0000-000000000001',
    10,
    'active',
    'ffb00000-0000-0000-0000-000000000001',
    'approved',
    'approved'
  ),
  (
    'ffa00000-0000-0000-0000-000000000002',
    'ff400000-0000-0000-0000-000000000001',
    'ff400000-0000-0000-0000-000000000002',
    'ff500000-0000-0000-0000-000000000001',
    5,
    'proposed',
    'ffb00000-0000-0000-0000-000000000001',
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
        proname = 'set_per_target_bulk_assignment'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_per_target_bulk_assignment is SECURITY DEFINER'
  );

-- ===========================================================================
-- SUPER ADMIN: raise deposit to 2 (picks 2 unassigned NPCs)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.after
      from
        public.set_per_target_bulk_assignment (
          'ff400000-0000-0000-0000-000000000001',
          'deposit',
          'ff900000-0000-0000-0000-000000000001',
          2
        ) r
    ),
    2,
    'super admin: raise deposit to 2 returns after = 2'
  );

select
  is (
    (
      select
        r.before
      from
        public.set_per_target_bulk_assignment (
          'ff400000-0000-0000-0000-000000000001',
          'deposit',
          'ff900000-0000-0000-0000-000000000001',
          2
        ) r
    ),
    2,
    'no-op when target equals current count: before = 2'
  );

reset role;

-- Verify 2 rows were inserted
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.assignment_type = 'deposit'
        and ca.deposit_instance_id = 'ff900000-0000-0000-0000-000000000001'
    ),
    2,
    'deposit: two assignment rows after raise to 2'
  );

-- ===========================================================================
-- LOWER deposit from 2 to 1
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_per_target_bulk_assignment (
          'ff400000-0000-0000-0000-000000000001',
          'deposit',
          'ff900000-0000-0000-0000-000000000001',
          1
        ) r
    ),
    2,
    'lower deposit to 1: before = 2'
  );

select
  is (
    (
      select
        r.after
      from
        public.set_per_target_bulk_assignment (
          'ff400000-0000-0000-0000-000000000001',
          'deposit',
          'ff900000-0000-0000-0000-000000000001',
          1
        ) r
    ),
    1,
    'lower deposit to 1: after = 1'
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
        and ca.deposit_instance_id = 'ff900000-0000-0000-0000-000000000001'
    ),
    1,
    'deposit: one assignment row after lowering to 1'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: husbandry assignment
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'husbandry',
      'ff900000-0000-0000-0000-000000000004',
      1
    )
    $test$,
    'settlement manager can raise husbandry to 1'
  );

-- ===========================================================================
-- REJECTION: outsider
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'deposit',
      'ff900000-0000-0000-0000-000000000001',
      1
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
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      null,
      'deposit',
      'ff900000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'P0002',
    null,
    'null settlement_id raises P0002'
  );

-- ===========================================================================
-- REJECTION: null p_target_count
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'deposit',
      'ff900000-0000-0000-0000-000000000001',
      null
    )
    $test$,
    'P0002',
    null,
    'null target_count raises P0002'
  );

-- ===========================================================================
-- REJECTION: negative target count
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'deposit',
      'ff900000-0000-0000-0000-000000000001',
      -1
    )
    $test$,
    'P0001',
    null,
    'negative target count raises P0001'
  );

-- ===========================================================================
-- REJECTION: unknown assignment_type
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'standard_job',
      'ff900000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'P0001',
    null,
    'unknown assignment_type raises P0001'
  );

-- ===========================================================================
-- REJECTION: deposit exceeds max_workers (max=2, target=3)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'deposit',
      'ff900000-0000-0000-0000-000000000003',
      3
    )
    $test$,
    'P0001',
    null,
    'target count exceeding max_workers raises P0001'
  );

-- ===========================================================================
-- BOUNDARY: deposit at exactly max_workers (max=2, target=2)
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'deposit',
      'ff900000-0000-0000-0000-000000000003',
      2
    )
    $test$,
    'deposit bulk assignment at exactly max_workers succeeds'
  );

-- ===========================================================================
-- REJECTION: husbandry with trashed job
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'husbandry',
      'ff900000-0000-0000-0000-000000000005',
      1
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
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'culling',
      'ff900000-0000-0000-0000-000000000005',
      1
    )
    $test$,
    'P0001',
    null,
    'culling with trashed job raises P0001'
  );

-- ===========================================================================
-- REJECTION: inactive deposit
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'deposit',
      'ff900000-0000-0000-0000-000000000002',
      1
    )
    $test$,
    'P0001',
    null,
    'depleted deposit raises P0001'
  );

-- ===========================================================================
-- REJECTION: trade_route without trade_route_end
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'trade_route',
      'ffa00000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'P0001',
    null,
    'trade_route without trade_route_end raises P0001'
  );

-- ===========================================================================
-- REJECTION: trade_route inactive (proposed)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'trade_route',
      'ffa00000-0000-0000-0000-000000000002',
      1,
      'origin'
    )
    $test$,
    'P0001',
    null,
    'proposed trade route raises P0001'
  );

-- ===========================================================================
-- REJECTION: insufficient unassigned NPCs (need 10, only 1 left)
-- After prior tests, most NPCs are assigned. Set up exactly:
-- clear all assignments, then assign 2 to deposit, leaving 1 unassigned.
-- ===========================================================================
delete from public.citizen_assignments;

set
  local "request.jwt.claims" = '{"sub":"ff100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Assign 2 of 3 NPCs to a deposit, leaving 1 unassigned
select
  set_per_target_bulk_assignment (
    'ff400000-0000-0000-0000-000000000001',
    'deposit',
    'ff900000-0000-0000-0000-000000000001',
    2
  );

select
  throws_ok (
    $test$
    select public.set_per_target_bulk_assignment(
      'ff400000-0000-0000-0000-000000000001',
      'husbandry',
      'ff900000-0000-0000-0000-000000000004',
      2
    )
    $test$,
    'P0001',
    null,
    'insufficient unassigned NPCs raises P0001'
  );

-- ===========================================================================
-- CLEAR: zero count removes all assignments for a target
-- ===========================================================================
select
  is (
    (
      select
        r.after
      from
        public.set_per_target_bulk_assignment (
          'ff400000-0000-0000-0000-000000000001',
          'deposit',
          'ff900000-0000-0000-0000-000000000001',
          0
        ) r
    ),
    0,
    'setting count to 0 clears all deposit assignments (after = 0)'
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
        and ca.deposit_instance_id = 'ff900000-0000-0000-0000-000000000001'
    ),
    0,
    'deposit has no assignments after clearing to 0'
  );

select
  *
from
  finish ();

rollback;
