-- pgTAP smoke test: every Epic-5 RPC executes with valid params.
-- Calls each of the 19 settlement-operations RPCs:
--   • once as a super admin / world owner        (happy path)
--   • once as a Settlement Manager or Nation Manager (happy path where spec allows;
--     42501 rejection for admin-only RPCs)
--   • once as anon                                (42501 rejection)
-- Catches missing GRANTs, incorrect auth guards, and return-shape bugs before
-- they reach production.
-- Run with: npx supabase test db
begin;

select
  plan (57);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all 5e-prefixed, unique to this file):
--   5e10xxxx = users            5e20xxxx = worlds
--   5e30xxxx = nations          5e40xxxx = settlements
--   5e50xxxx = resources        5e60xxxx = building_blueprints
--   5e70xxxx = tiers            5e80xxxx = job_definitions
--   5e90xxxx = deposit_types    5ea0xxxx = deposit_instances
--   5eb0xxxx = mpt              5ec0xxxx = mpi
--   5ed0xxxx = citizens         5ee0xxxx = settlement_buildings
--   5ef0xxxx = construction_projects   5ef8xxxx = trade_routes
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
    '5e100000-0000-0000-0000-000000000001',
    'smoke5-admin@example.com',
    'x',
    now(),
    '{"username":"smoke5_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '5e100000-0000-0000-0000-000000000002',
    'smoke5-sm@example.com',
    'x',
    now(),
    '{"username":"smoke5_sm"}'::jsonb,
    now(),
    now()
  ),
  (
    '5e100000-0000-0000-0000-000000000003',
    'smoke5-nm@example.com',
    'x',
    now(),
    '{"username":"smoke5_nm"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 World',
    '5e100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '5e300000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Origin Nation'
  ),
  (
    '5e300000-0000-0000-0000-000000000002',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Dest Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '5e400000-0000-0000-0000-000000000001',
    '5e300000-0000-0000-0000-000000000001',
    'Smoke5 Origin Settlement'
  ),
  (
    '5e400000-0000-0000-0000-000000000002',
    '5e300000-0000-0000-0000-000000000002',
    'Smoke5 Dest Settlement'
  );

-- Resources (settlement_resource_stockpiles auto-seeded by triggers)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    '5e500000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Ore',
    'smoke5-ore'
  );

-- Job definitions
-- deposit/husbandry/culling jobs must have base_capacity = null per constraint
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    '5e800000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Standard Job',
    'smoke5-standard-job',
    'standard',
    10
  ),
  (
    '5e800000-0000-0000-0000-000000000002',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Deposit Job',
    'smoke5-deposit-job',
    'deposit',
    null
  ),
  (
    '5e800000-0000-0000-0000-000000000003',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Husbandry Job',
    'smoke5-husbandry-job',
    'husbandry',
    null
  ),
  (
    '5e800000-0000-0000-0000-000000000004',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Culling Job',
    'smoke5-culling-job',
    'culling',
    null
  );

-- Building blueprint + tier
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    '5e600000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Forge',
    'smoke5-forge'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    '5e700000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    1,
    100
  );

-- Deposit type
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
    '5e900000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Coal',
    'smoke5-coal',
    '5e800000-0000-0000-0000-000000000002',
    1
  );

-- Managed population type
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals
  )
values
  (
    '5eb00000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'Smoke5 Cattle',
    'smoke5-cattle',
    '5e800000-0000-0000-0000-000000000003',
    '5e800000-0000-0000-0000-000000000004',
    10
  );

-- Deposit instances (active)
-- DI1: set_deposit_instance_max_workers + per_target_assignment
-- DI2: admin remove_deposit_instance
-- DI3: anon remove_deposit_instance rejection target
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    '5ea00000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000001',
    '5e900000-0000-0000-0000-000000000001',
    'Smoke5 Coal Seam A',
    'active'
  ),
  (
    '5ea00000-0000-0000-0000-000000000002',
    '5e400000-0000-0000-0000-000000000001',
    '5e900000-0000-0000-0000-000000000001',
    'Smoke5 Coal Seam B',
    'active'
  ),
  (
    '5ea00000-0000-0000-0000-000000000003',
    '5e400000-0000-0000-0000-000000000001',
    '5e900000-0000-0000-0000-000000000001',
    'Smoke5 Coal Seam C',
    'active'
  );

-- Managed population instances (active)
-- MPI1: set_configured_cull_quantity
-- MPI2: admin remove_managed_population_instance
-- MPI3: anon remove rejection target
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
    '5ec00000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000001',
    '5eb00000-0000-0000-0000-000000000001',
    'Smoke5 Herd A',
    100,
    0,
    'active'
  ),
  (
    '5ec00000-0000-0000-0000-000000000002',
    '5e400000-0000-0000-0000-000000000001',
    '5eb00000-0000-0000-0000-000000000001',
    'Smoke5 Herd B',
    50,
    0,
    'active'
  ),
  (
    '5ec00000-0000-0000-0000-000000000003',
    '5e400000-0000-0000-0000-000000000001',
    '5eb00000-0000-0000-0000-000000000001',
    'Smoke5 Herd C',
    50,
    0,
    'active'
  );

-- Citizens:
--   5ed...001 – NM player character (user = NM user, nation_manager for origin nation)
--   5ed...002 – SM player character (user = SM user, settlement_manager for origin settlement)
--   5ed...003 – NPC in origin settlement (proposer/approver citizen for trade route calls)
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
    role_settlement_id,
    settlement_id
  )
values
  (
    '5ed00000-0000-0000-0000-000000000001',
    '5e200000-0000-0000-0000-000000000001',
    'player_character',
    'Smoke5 NM PC',
    'alive',
    '5e100000-0000-0000-0000-000000000003',
    'nation_manager',
    '5e300000-0000-0000-0000-000000000001',
    null,
    '5e400000-0000-0000-0000-000000000001'
  ),
  (
    '5ed00000-0000-0000-0000-000000000002',
    '5e200000-0000-0000-0000-000000000001',
    'player_character',
    'Smoke5 SM PC',
    'alive',
    '5e100000-0000-0000-0000-000000000002',
    'settlement_manager',
    null,
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000001'
  ),
  (
    '5ed00000-0000-0000-0000-000000000003',
    '5e200000-0000-0000-0000-000000000001',
    'npc',
    'Smoke5 NPC Proposer',
    'alive',
    null,
    'none',
    null,
    null,
    '5e400000-0000-0000-0000-000000000001'
  );

-- Settlement buildings (active; used for manual_deconstruct, admin-only)
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    activated_on_turn_number
  )
values
  (
    '5ee00000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'active',
    1
  ),
  (
    '5ee00000-0000-0000-0000-000000000002',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'active',
    1
  );

-- Construction projects:
--   P3 (pos=1), P4 (pos=2), P5 (pos=3) – survive for reorder + bulk assignment
--   P1 (pos=4) – admin cancels, P2 (pos=5) – SM cancels
-- Positions 1-3 are occupied by the surviving projects so that after P1/P2 are
-- cancelled the reorder temp-shift range [N+1,2N]=[4,6] does not collide with
-- any live position.
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position
  )
values
  (
    '5ef00000-0000-0000-0000-000000000003',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'queued',
    1
  ),
  (
    '5ef00000-0000-0000-0000-000000000004',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'queued',
    2
  ),
  (
    '5ef00000-0000-0000-0000-000000000005',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'queued',
    3
  ),
  (
    '5ef00000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'queued',
    4
  ),
  (
    '5ef00000-0000-0000-0000-000000000002',
    '5e400000-0000-0000-0000-000000000001',
    '5e600000-0000-0000-0000-000000000001',
    '5e700000-0000-0000-0000-000000000001',
    'queued',
    5
  );

-- Pre-created trade routes:
--   R1 (proposed) – admin approve_trade_route_side
--   R2 (proposed) – NM approve_trade_route_side
--   R3 (proposed) – admin reject_trade_route_side
--   R4 (proposed) – NM reject_trade_route_side
--   R5 (proposed) – admin cancel_trade_route
--   R6 (proposed) – NM cancel_trade_route
--   R7 (active, both approved) – admin replace_trade_route
--   R8 (active, both approved) – NM replace_trade_route
--   R9 (active, both approved) – anon replace_trade_route rejection
-- R9 is kept separate because the status check precedes the auth check in
-- replace_trade_route; reusing an already-replaced route would yield P0001
-- instead of the expected 42501.
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    '5ef80000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'proposed',
    '5ed00000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    '5ef80000-0000-0000-0000-000000000002',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'proposed',
    '5ed00000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    '5ef80000-0000-0000-0000-000000000003',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'proposed',
    '5ed00000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    '5ef80000-0000-0000-0000-000000000004',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'proposed',
    '5ed00000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    '5ef80000-0000-0000-0000-000000000005',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'proposed',
    '5ed00000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    '5ef80000-0000-0000-0000-000000000006',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'proposed',
    '5ed00000-0000-0000-0000-000000000003',
    'pending',
    'pending'
  ),
  (
    '5ef80000-0000-0000-0000-000000000007',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'active',
    '5ed00000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    '5ef80000-0000-0000-0000-000000000008',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'active',
    '5ed00000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  ),
  (
    '5ef80000-0000-0000-0000-000000000009',
    '5e400000-0000-0000-0000-000000000001',
    '5e400000-0000-0000-0000-000000000002',
    'active',
    '5ed00000-0000-0000-0000-000000000003',
    'approved',
    'approved'
  );

insert into
  public.trade_route_legs (
    trade_route_id,
    direction,
    resource_id,
    quantity_per_transition
  )
select
  tr.id,
  'send',
  '5e500000-0000-0000-0000-000000000001'::uuid,
  10
from
  public.trade_routes tr
where
  tr.id in (
    '5ef80000-0000-0000-0000-000000000001',
    '5ef80000-0000-0000-0000-000000000002',
    '5ef80000-0000-0000-0000-000000000003',
    '5ef80000-0000-0000-0000-000000000004',
    '5ef80000-0000-0000-0000-000000000005',
    '5ef80000-0000-0000-0000-000000000006',
    '5ef80000-0000-0000-0000-000000000007',
    '5ef80000-0000-0000-0000-000000000008',
    '5ef80000-0000-0000-0000-000000000009'
  );

-- ===========================================================================
-- Tests
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- set_settlement_stockpile_quantity (admin-only: world admin / super admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_settlement_stockpile_quantity(
        '5e400000-0000-0000-0000-000000000001',
        '5e500000-0000-0000-0000-000000000001',
        500
      )
    $test$,
    'set_settlement_stockpile_quantity: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select * from public.set_settlement_stockpile_quantity(
        '5e400000-0000-0000-0000-000000000001',
        '5e500000-0000-0000-0000-000000000001',
        100
      )
    $test$,
    '42501',
    null,
    'set_settlement_stockpile_quantity: SM rejected (admin-only)'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.set_settlement_stockpile_quantity(
        '5e400000-0000-0000-0000-000000000001',
        '5e500000-0000-0000-0000-000000000001',
        100
      )
    $test$,
    '42501',
    null,
    'set_settlement_stockpile_quantity: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- cancel_construction_project
-- Admin cancels P1, SM cancels P2 — must run before reorder so only 3
-- non-terminal projects (P3/P4/P5) remain when the reorder input is validated.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.cancel_construction_project(
        '5ef00000-0000-0000-0000-000000000001'
      )
    $test$,
    'cancel_construction_project: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.cancel_construction_project(
        '5ef00000-0000-0000-0000-000000000002'
      )
    $test$,
    'cancel_construction_project: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.cancel_construction_project(
        '5ef00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'cancel_construction_project: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- reorder_construction_projects
-- P1 (pos=4) and P2 (pos=5) are now cancelled; P3/P4/P5 at positions 1/2/3
-- are the only non-terminal projects.  Both permutations must list all 3.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.reorder_construction_projects(
        '5e400000-0000-0000-0000-000000000001',
        '[
          {"projectId":"5ef00000-0000-0000-0000-000000000004","position":1},
          {"projectId":"5ef00000-0000-0000-0000-000000000003","position":2},
          {"projectId":"5ef00000-0000-0000-0000-000000000005","position":3}
        ]'::jsonb
      )
    $test$,
    'reorder_construction_projects: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.reorder_construction_projects(
        '5e400000-0000-0000-0000-000000000001',
        '[
          {"projectId":"5ef00000-0000-0000-0000-000000000003","position":1},
          {"projectId":"5ef00000-0000-0000-0000-000000000004","position":2},
          {"projectId":"5ef00000-0000-0000-0000-000000000005","position":3}
        ]'::jsonb
      )
    $test$,
    'reorder_construction_projects: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.reorder_construction_projects(
        '5e400000-0000-0000-0000-000000000001',
        '[{"projectId":"5ef00000-0000-0000-0000-000000000003","position":1}]'::jsonb
      )
    $test$,
    '42501',
    null,
    'reorder_construction_projects: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- create_construction_project
-- New projects added after reorder so they do not affect the non-terminal count.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.create_construction_project(
        '5e400000-0000-0000-0000-000000000001',
        '5e600000-0000-0000-0000-000000000001',
        '5e700000-0000-0000-0000-000000000001'
      )
    $test$,
    'create_construction_project: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.create_construction_project(
        '5e400000-0000-0000-0000-000000000001',
        '5e600000-0000-0000-0000-000000000001',
        '5e700000-0000-0000-0000-000000000001'
      )
    $test$,
    'create_construction_project: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.create_construction_project(
        '5e400000-0000-0000-0000-000000000001',
        '5e600000-0000-0000-0000-000000000001',
        '5e700000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'create_construction_project: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- manual_deconstruct_settlement_building (admin-only: world admin / super admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.manual_deconstruct_settlement_building(
        '5ee00000-0000-0000-0000-000000000001'
      )
    $test$,
    'manual_deconstruct_settlement_building: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select * from public.manual_deconstruct_settlement_building(
        '5ee00000-0000-0000-0000-000000000002'
      )
    $test$,
    '42501',
    null,
    'manual_deconstruct_settlement_building: SM rejected (admin-only)'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.manual_deconstruct_settlement_building(
        '5ee00000-0000-0000-0000-000000000002'
      )
    $test$,
    '42501',
    null,
    'manual_deconstruct_settlement_building: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- create_deposit_instance (admin-only: world admin / super admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.create_deposit_instance(
        '5e400000-0000-0000-0000-000000000001',
        '5e900000-0000-0000-0000-000000000001',
        'Admin-Created Seam',
        5,
        '[{"resource_id":"5e500000-0000-0000-0000-000000000001","initial_quantity":500}]'::jsonb
      )
    $test$,
    'create_deposit_instance: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select * from public.create_deposit_instance(
        '5e400000-0000-0000-0000-000000000001',
        '5e900000-0000-0000-0000-000000000001',
        'SM-Created Seam',
        5,
        '[{"resource_id":"5e500000-0000-0000-0000-000000000001","initial_quantity":500}]'::jsonb
      )
    $test$,
    '42501',
    null,
    'create_deposit_instance: SM rejected (admin-only)'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.create_deposit_instance(
        '5e400000-0000-0000-0000-000000000001',
        '5e900000-0000-0000-0000-000000000001',
        'Anon Seam',
        5,
        '[{"resource_id":"5e500000-0000-0000-0000-000000000001","initial_quantity":500}]'::jsonb
      )
    $test$,
    '42501',
    null,
    'create_deposit_instance: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- set_deposit_instance_max_workers (settlement/nation manager, world admin, super admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_deposit_instance_max_workers(
        '5ea00000-0000-0000-0000-000000000001',
        10,
        null
      )
    $test$,
    'set_deposit_instance_max_workers: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_deposit_instance_max_workers(
        '5ea00000-0000-0000-0000-000000000001',
        20,
        null
      )
    $test$,
    'set_deposit_instance_max_workers: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.set_deposit_instance_max_workers(
        '5ea00000-0000-0000-0000-000000000001',
        5,
        null
      )
    $test$,
    '42501',
    null,
    'set_deposit_instance_max_workers: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- remove_deposit_instance (admin-only: world admin / super admin)
-- DI2 removed by admin; DI3 used as rejection target for SM + anon tests.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.remove_deposit_instance(
        '5ea00000-0000-0000-0000-000000000002'
      )
    $test$,
    'remove_deposit_instance: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select * from public.remove_deposit_instance(
        '5ea00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'remove_deposit_instance: SM rejected (admin-only)'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.remove_deposit_instance(
        '5ea00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'remove_deposit_instance: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- create_managed_population_instance (admin-only: world admin / super admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.create_managed_population_instance(
        '5e400000-0000-0000-0000-000000000001',
        '5eb00000-0000-0000-0000-000000000001',
        'Admin-Created Herd',
        200,
        0
      )
    $test$,
    'create_managed_population_instance: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
      select * from public.create_managed_population_instance(
        '5e400000-0000-0000-0000-000000000001',
        '5eb00000-0000-0000-0000-000000000001',
        'NM-Created Herd',
        200,
        0
      )
    $test$,
    '42501',
    null,
    'create_managed_population_instance: NM rejected (admin-only)'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.create_managed_population_instance(
        '5e400000-0000-0000-0000-000000000001',
        '5eb00000-0000-0000-0000-000000000001',
        'Anon Herd',
        200,
        0
      )
    $test$,
    '42501',
    null,
    'create_managed_population_instance: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- set_configured_cull_quantity (settlement/nation manager, world admin, super admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_configured_cull_quantity(
        '5ec00000-0000-0000-0000-000000000001',
        10
      )
    $test$,
    'set_configured_cull_quantity: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_configured_cull_quantity(
        '5ec00000-0000-0000-0000-000000000001',
        5
      )
    $test$,
    'set_configured_cull_quantity: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.set_configured_cull_quantity(
        '5ec00000-0000-0000-0000-000000000001',
        0
      )
    $test$,
    '42501',
    null,
    'set_configured_cull_quantity: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- remove_managed_population_instance (admin-only: world admin / super admin)
-- MPI2 removed by admin; MPI3 used as rejection target for SM + anon tests.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.remove_managed_population_instance(
        '5ec00000-0000-0000-0000-000000000002'
      )
    $test$,
    'remove_managed_population_instance: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select * from public.remove_managed_population_instance(
        '5ec00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'remove_managed_population_instance: SM rejected (admin-only)'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.remove_managed_population_instance(
        '5ec00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'remove_managed_population_instance: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- propose_trade_route
-- NM uses NPC citizen 5ed...003 (in origin settlement → origin nation, which
-- NM manages) to satisfy the non-admin nation check.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select public.propose_trade_route(
        '5e400000-0000-0000-0000-000000000001',
        '5e400000-0000-0000-0000-000000000002',
        jsonb_build_array(jsonb_build_object(
          'direction', 'send',
          'resource_id', '5e500000-0000-0000-0000-000000000001',
          'quantity', 10
        )),
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'propose_trade_route: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
      select public.propose_trade_route(
        '5e400000-0000-0000-0000-000000000001',
        '5e400000-0000-0000-0000-000000000002',
        jsonb_build_array(jsonb_build_object(
          'direction', 'send',
          'resource_id', '5e500000-0000-0000-0000-000000000001',
          'quantity', 10
        )),
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'propose_trade_route: NM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select public.propose_trade_route(
        '5e400000-0000-0000-0000-000000000001',
        '5e400000-0000-0000-0000-000000000002',
        jsonb_build_array(jsonb_build_object(
          'direction', 'send',
          'resource_id', '5e500000-0000-0000-0000-000000000001',
          'quantity', 10
        )),
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'propose_trade_route: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- approve_trade_route_side
-- Admin approves R1 (origin side); NM approves R2 (origin side).
-- NM manages origin nation; NPC 5ed...003 is in origin settlement.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.approve_trade_route_side(
        '5ef80000-0000-0000-0000-000000000001',
        'origin',
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'approve_trade_route_side: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.approve_trade_route_side(
        '5ef80000-0000-0000-0000-000000000002',
        'origin',
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'approve_trade_route_side: NM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.approve_trade_route_side(
        '5ef80000-0000-0000-0000-000000000001',
        'origin',
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'approve_trade_route_side: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- reject_trade_route_side
-- Admin rejects R3 (origin side); NM rejects R4 (origin side).
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.reject_trade_route_side(
        '5ef80000-0000-0000-0000-000000000003',
        'origin',
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'reject_trade_route_side: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.reject_trade_route_side(
        '5ef80000-0000-0000-0000-000000000004',
        'origin',
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'reject_trade_route_side: NM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.reject_trade_route_side(
        '5ef80000-0000-0000-0000-000000000005',
        'origin',
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'reject_trade_route_side: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- cancel_trade_route
-- Admin cancels R5; NM cancels R6 (NM manages origin nation for R6).
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.cancel_trade_route(
        '5ef80000-0000-0000-0000-000000000005'
      )
    $test$,
    'cancel_trade_route: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.cancel_trade_route(
        '5ef80000-0000-0000-0000-000000000006'
      )
    $test$,
    'cancel_trade_route: NM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.cancel_trade_route(
        '5ef80000-0000-0000-0000-000000000007'
      )
    $test$,
    '42501',
    null,
    'cancel_trade_route: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- replace_trade_route
-- R7 and R8 are active (both sides approved).
-- Admin replaces R7; NM replaces R8 using NPC 5ed...003 (origin nation).
-- R9 (active) is the anon rejection target; R7/R8 are already replaced by the
-- time the anon test runs, and the status check precedes the auth check so a
-- replaced route would yield P0001 instead of 42501.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.replace_trade_route(
        '5ef80000-0000-0000-0000-000000000007',
        '{"origin_settlement_id":"5e400000-0000-0000-0000-000000000001","destination_settlement_id":"5e400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"5e500000-0000-0000-0000-000000000001","quantity":15}]}'::jsonb,
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'replace_trade_route: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.replace_trade_route(
        '5ef80000-0000-0000-0000-000000000008',
        '{"origin_settlement_id":"5e400000-0000-0000-0000-000000000001","destination_settlement_id":"5e400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"5e500000-0000-0000-0000-000000000001","quantity":15}]}'::jsonb,
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    'replace_trade_route: NM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.replace_trade_route(
        '5ef80000-0000-0000-0000-000000000009',
        '{"origin_settlement_id":"5e400000-0000-0000-0000-000000000001","destination_settlement_id":"5e400000-0000-0000-0000-000000000002","legs":[{"direction":"send","resource_id":"5e500000-0000-0000-0000-000000000001","quantity":15}]}'::jsonb,
        '5ed00000-0000-0000-0000-000000000003'
      )
    $test$,
    '42501',
    null,
    'replace_trade_route: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- set_bulk_standard_job_assignment
-- target_count=0 lowers to zero assignments.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_bulk_standard_job_assignment(
        '5e400000-0000-0000-0000-000000000001',
        '5e800000-0000-0000-0000-000000000001',
        0
      )
    $test$,
    'set_bulk_standard_job_assignment: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_bulk_standard_job_assignment(
        '5e400000-0000-0000-0000-000000000001',
        '5e800000-0000-0000-0000-000000000001',
        0
      )
    $test$,
    'set_bulk_standard_job_assignment: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.set_bulk_standard_job_assignment(
        '5e400000-0000-0000-0000-000000000001',
        '5e800000-0000-0000-0000-000000000001',
        0
      )
    $test$,
    '42501',
    null,
    'set_bulk_standard_job_assignment: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- set_bulk_construction_assignment
-- Targets P5 (queued).  target_count=0 lowers to zero assignments.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_bulk_construction_assignment(
        '5ef00000-0000-0000-0000-000000000005',
        0
      )
    $test$,
    'set_bulk_construction_assignment: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_bulk_construction_assignment(
        '5ef00000-0000-0000-0000-000000000005',
        0
      )
    $test$,
    'set_bulk_construction_assignment: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.set_bulk_construction_assignment(
        '5ef00000-0000-0000-0000-000000000005',
        0
      )
    $test$,
    '42501',
    null,
    'set_bulk_construction_assignment: anon rejected with 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- set_per_target_assignment
-- Empty citizen list (desired final state = no assignees) is valid.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_per_target_assignment(
        '5e400000-0000-0000-0000-000000000001',
        'deposit',
        '5ea00000-0000-0000-0000-000000000001',
        array[]::uuid[]
      )
    $test$,
    'set_per_target_assignment: admin succeeds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"5e100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
      select * from public.set_per_target_assignment(
        '5e400000-0000-0000-0000-000000000001',
        'deposit',
        '5ea00000-0000-0000-0000-000000000001',
        array[]::uuid[]
      )
    $test$,
    'set_per_target_assignment: SM succeeds'
  );

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
      select * from public.set_per_target_assignment(
        '5e400000-0000-0000-0000-000000000001',
        'deposit',
        '5ea00000-0000-0000-0000-000000000001',
        array[]::uuid[]
      )
    $test$,
    '42501',
    null,
    'set_per_target_assignment: anon rejected with 42501'
  );

reset role;

select
  *
from
  finish ();

rollback;
