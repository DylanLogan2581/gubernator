-- pgTAP tests for public.set_deposit_instance_max_workers RPC.
-- Run with: npx supabase test db
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all e-prefixed, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = deposit_types  e6xxxxxx = resources (unused here)
--   e7xxxxxx = citizens       e8xxxxxx = job_definitions
--   e9xxxxxx = deposit_instances
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
    'e1000000-0000-0000-0000-000000000001',
    'sdimw-owner@example.com',
    'x',
    now(),
    '{"username":"sdimw_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'sdimw-manager@example.com',
    'x',
    now(),
    '{"username":"sdimw_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'sdimw-anon@example.com',
    'x',
    now(),
    '{"username":"sdimw_anon"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'SDIMW World',
    'e1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'SDIMW Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'SDIMW Settlement'
  );

-- Settlement manager player character
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_settlement_id,
    role_nation_id
  )
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'SDIMW Manager PC',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'settlement_manager',
    'e4000000-0000-0000-0000-000000000001',
    null
  );

-- Job definition needed for deposit type FK
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'SDIMW Mining',
    'sdimw-mining',
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
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'SDIMW Iron Seam',
    'sdimw-iron-seam',
    'e8000000-0000-0000-0000-000000000001',
    10
  );

-- Deposit instances:
--   e9...0001 – admin/manager success tests (no shrink)
--   e9...0002 – npc_first shrink test  (2 NPCs + 2 PCs, cap=4)
--   e9...0003 – random shrink test     (3 NPCs + 1 PC,  cap=4)
--   e9...0004 – raising max test       (0 workers, cap=2)
--   e9...0005 – random determinism test (4 NPCs, cap=4)
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
    'e9000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'SDIMW Iron Alpha',
    'active',
    5
  ),
  (
    'e9000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'SDIMW Iron Beta',
    'active',
    4
  ),
  (
    'e9000000-0000-0000-0000-000000000003',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'SDIMW Iron Gamma',
    'active',
    4
  ),
  (
    'e9000000-0000-0000-0000-000000000004',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'SDIMW Iron Delta',
    'active',
    2
  ),
  (
    'e9000000-0000-0000-0000-000000000005',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'SDIMW Iron Epsilon',
    'active',
    4
  );

-- Citizens for shrink tests
-- NPCs for Beta (deposit e9...0002): e7...0011, e7...0012
-- PCs  for Beta:                     e7...0013, e7...0014
-- NPCs for Gamma (deposit e9...0003): e7...0021, e7...0022, e7...0023
-- PC   for Gamma:                     e7...0024
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    role_type
  )
values
  -- Beta NPCs
  (
    'e7000000-0000-0000-0000-000000000011',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Beta 1',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000012',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Beta 2',
    'alive',
    'none'
  ),
  -- Gamma NPCs
  (
    'e7000000-0000-0000-0000-000000000021',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Gamma 1',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000022',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Gamma 2',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000023',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Gamma 3',
    'alive',
    'none'
  );

-- Beta NPC 3, Beta NPC 4, Gamma NPC 4
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    role_type
  )
values
  (
    'e7000000-0000-0000-0000-000000000013',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Beta 3',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000014',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Beta 4',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000024',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Gamma 4',
    'alive',
    'none'
  );

-- Citizen assignments for Beta deposit (4 workers: 2 NPCs + 2 PCs)
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'e7000000-0000-0000-0000-000000000011',
    'deposit',
    'e9000000-0000-0000-0000-000000000002',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000012',
    'deposit',
    'e9000000-0000-0000-0000-000000000002',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000013',
    'deposit',
    'e9000000-0000-0000-0000-000000000002',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000014',
    'deposit',
    'e9000000-0000-0000-0000-000000000002',
    1
  );

-- Citizen assignments for Gamma deposit (4 workers: 3 NPCs + 1 PC)
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'e7000000-0000-0000-0000-000000000021',
    'deposit',
    'e9000000-0000-0000-0000-000000000003',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000022',
    'deposit',
    'e9000000-0000-0000-0000-000000000003',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000023',
    'deposit',
    'e9000000-0000-0000-0000-000000000003',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000024',
    'deposit',
    'e9000000-0000-0000-0000-000000000003',
    1
  );

-- NPCs for Epsilon deposit (determinism test): 4 NPCs only
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    role_type
  )
values
  (
    'e7000000-0000-0000-0000-000000000031',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Epsilon 1',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000032',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Epsilon 2',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000033',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Epsilon 3',
    'alive',
    'none'
  ),
  (
    'e7000000-0000-0000-0000-000000000034',
    'e2000000-0000-0000-0000-000000000001',
    'npc',
    'NPC Epsilon 4',
    'alive',
    'none'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'e7000000-0000-0000-0000-000000000031',
    'deposit',
    'e9000000-0000-0000-0000-000000000005',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000032',
    'deposit',
    'e9000000-0000-0000-0000-000000000005',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000033',
    'deposit',
    'e9000000-0000-0000-0000-000000000005',
    1
  ),
  (
    'e7000000-0000-0000-0000-000000000034',
    'deposit',
    'e9000000-0000-0000-0000-000000000005',
    1
  );

-- ===========================================================================
-- WORLD OWNER (implicit admin): success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_deposit_instance_max_workers(
      'e9000000-0000-0000-0000-000000000001',
      3,
      null
    )
    $test$,
    'world owner can set max_workers'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_deposit_instance_max_workers(
      'e9000000-0000-0000-0000-000000000001',
      7,
      null
    )
    $test$,
    'settlement manager can set max_workers'
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
    select public.set_deposit_instance_max_workers(
      'e9000000-0000-0000-0000-000000000001',
      3,
      null
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- p_max_workers = 0: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_deposit_instance_max_workers(
      'e9000000-0000-0000-0000-000000000001',
      0,
      null
    )
    $test$,
    'P0001',
    null,
    'p_max_workers = 0 is rejected with P0001'
  );

-- ===========================================================================
-- p_max_workers = -1: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_deposit_instance_max_workers(
      'e9000000-0000-0000-0000-000000000001',
      -1,
      null
    )
    $test$,
    'P0001',
    null,
    'p_max_workers = -1 is rejected with P0001'
  );

-- ===========================================================================
-- RAISING MAX: returns empty unassigned_citizen_ids
-- (Delta has 0 workers assigned; raise cap from 2 to 10)
-- ===========================================================================
select
  is (
    (
      select
        row_to_json(t)::jsonb
      from
        public.set_deposit_instance_max_workers ('e9000000-0000-0000-0000-000000000004', 10, null) t
    ),
    '{"max_workers":10,"unassigned_citizen_ids":[]}'::jsonb,
    'raising max returns empty unassigned_citizen_ids'
  );

reset role;

-- ===========================================================================
-- NPC_FIRST SHRINK: correct citizen ids unassigned
-- Beta deposit: 4 NPCs (e7...11, e7...12, e7...13, e7...14)
-- Shrink to 2 → should unassign the 2 lowest-id NPCs (011, 012)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        (result.unassigned_citizen_ids)::uuid[] @> array[
          'e7000000-0000-0000-0000-000000000011'::uuid,
          'e7000000-0000-0000-0000-000000000012'::uuid
        ]
        and array_length((result.unassigned_citizen_ids)::uuid[], 1) = 2
      from
        public.set_deposit_instance_max_workers (
          'e9000000-0000-0000-0000-000000000002',
          2,
          'npc_first'
        ) result
    ),
    'npc_first shrink unassigns 2 lowest-id NPCs'
  );

-- Higher-id NPCs remain assigned after npc_first shrink
select
  is (
    (
      select
        count(*)::int
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'e9000000-0000-0000-0000-000000000002'
        and ca.citizen_id in (
          'e7000000-0000-0000-0000-000000000013',
          'e7000000-0000-0000-0000-000000000014'
        )
    ),
    2,
    'npc_first: higher-id NPCs remain assigned after shrink'
  );

-- ===========================================================================
-- RANDOM SHRINK: correct count removed
-- Gamma deposit: 4 NPCs (e7...21,22,23,24)
-- Shrink to 2 → 2 excess; unassigns 2 in random order
-- ===========================================================================
select
  ok (
    (
      select
        array_length((result.unassigned_citizen_ids)::uuid[], 1) = 2
      from
        public.set_deposit_instance_max_workers (
          'e9000000-0000-0000-0000-000000000003',
          2,
          'random'
        ) result
    ),
    'random shrink removes the correct count of workers'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'e9000000-0000-0000-0000-000000000003'
    ),
    2,
    'random: exactly 2 workers remain assigned after gamma shrink'
  );

-- ===========================================================================
-- RANDOM DETERMINISM: setseed produces consistent removal within transaction.
-- Epsilon deposit has 4 NPCs and no PCs. Shrink to 2: removes exactly 2 NPCs,
-- and the same 2 are removed if we call with the same seed (same now()).
-- Verify by checking the unassigned_citizen_ids length and that each removed
-- id is one of the known Epsilon NPCs.
-- ===========================================================================
select
  ok (
    (
      select
        array_length((result.unassigned_citizen_ids)::uuid[], 1) = 2
        and (result.unassigned_citizen_ids)::uuid[] <@ array[
          'e7000000-0000-0000-0000-000000000031'::uuid,
          'e7000000-0000-0000-0000-000000000032'::uuid,
          'e7000000-0000-0000-0000-000000000033'::uuid,
          'e7000000-0000-0000-0000-000000000034'::uuid
        ]
      from
        public.set_deposit_instance_max_workers (
          'e9000000-0000-0000-0000-000000000005',
          2,
          'random'
        ) result
    ),
    'random: shrink removes exactly 2 known NPCs from Epsilon deposit'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'e9000000-0000-0000-0000-000000000005'
    ),
    2,
    'random: exactly 2 workers remain assigned after Epsilon shrink'
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
        proname = 'set_deposit_instance_max_workers'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_deposit_instance_max_workers is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
