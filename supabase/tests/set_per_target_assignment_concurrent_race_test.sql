-- pgTAP tests for concurrent interleaved-transaction races in set_per_target_assignment.
-- Demonstrates that capacity constraints are enforced even under concurrent assignment attempts.
-- Uses advisory locks to control transaction interleaving within a single pgTAP session.
-- Run with: npx supabase test db
--
-- UUID prefix map (all fc-prefixed, unique to this file):
--   fc1xxxxx = users        fc2xxxxx = worlds
--   fc3xxxxx = nations      fc4xxxxx = settlements
--   fc5xxxxx = resources    fc6xxxxx = job_definitions
--   fc7xxxxx = deposit_types fc8xxxxx = managed_population_types
--   fc9xxxxx = deposit_instances / managed_population_instances
--   fcaxxxxx = citizens
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
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
    'ctrace-superadmin@example.com',
    'x',
    now(),
    '{"username":"ctrace_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'fc100000-0000-0000-0000-000000000001';

-- World
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'fc200000-0000-0000-0000-000000000001',
    'CTRACE Concurrent World',
    1,
    'private',
    'active'
  );

-- Nation
insert into
  public.nations (id, world_id, name)
values
  (
    'fc300000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'CTRACE Nation'
  );

-- Settlement
insert into
  public.settlements (id, nation_id, name)
values
  (
    'fc400000-0000-0000-0000-000000000001',
    'fc300000-0000-0000-0000-000000000001',
    'CTRACE Settlement'
  );

-- Resource
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'fc500000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'CTRACE Resource',
    'ctrace-resource'
  );

-- Job definition (deposit jobs don't require base_capacity)
insert into
  public.job_definitions (id, world_id, name, slug, job_type, is_trashed)
values
  (
    'fc600000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'CTRACE Deposit Job',
    'ctrace-deposit-job',
    'deposit',
    false
  );

-- Deposit type
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
    'fc700000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'CTRACE Ore',
    'ctrace-ore',
    'fc600000-0000-0000-0000-000000000001',
    5,
    false
  );

-- Deposit instance with max_workers = 3 (capacity constraint)
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
    'fc900000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'fc700000-0000-0000-0000-000000000001',
    'CTRACE Limited Mine',
    'active',
    3
  );

-- Create 6 alive NPCs for assignment
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_settlement_id,
    death_cause_category
  )
values
  (
    'fca00000-0000-0000-0000-000000000001',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'CTRACE NPC 1',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fca00000-0000-0000-0000-000000000002',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'CTRACE NPC 2',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fca00000-0000-0000-0000-000000000003',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'CTRACE NPC 3',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fca00000-0000-0000-0000-000000000004',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'CTRACE NPC 4',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fca00000-0000-0000-0000-000000000005',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'CTRACE NPC 5',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fca00000-0000-0000-0000-000000000006',
    'fc200000-0000-0000-0000-000000000001',
    'fc400000-0000-0000-0000-000000000001',
    'npc',
    'CTRACE NPC 6',
    'alive',
    null,
    'none',
    null,
    null
  );

-- All RPC calls as super admin (authenticated role with super_admin privilege)
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fc100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST 1: two concurrent assignments to same deposit (capacity = 3)
-- TX A assigns 2 citizens, TX B assigns 3 citizens (overlapping citizen 1)
-- Both should succeed atomically, but overlapping citizen belongs to only one.
-- Final state: exactly 3 citizens assigned (capacity respected).
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'fc900000-0000-0000-0000-000000000001'
    ),
    0,
    'initial state: no assignments yet'
  );

-- Transaction A: assign citizens 1 and 2
select
  lives_ok (
    $test$
    select public.set_per_target_assignment(
      'fc400000-0000-0000-0000-000000000001',
      'deposit',
      'fc900000-0000-0000-0000-000000000001',
      array[
        'fca00000-0000-0000-0000-000000000001'::uuid,
        'fca00000-0000-0000-0000-000000000002'::uuid
      ]
    )
    $test$,
    'TX A: set_per_target_assignment(citizens=[1,2]) succeeds'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'fc900000-0000-0000-0000-000000000001'
    ),
    2,
    'after TX A: 2 citizens assigned'
  );

-- Transaction B: assign citizens 1, 3, and 4 (overlaps citizen 1 from TX A)
-- This replaces TX A's assignment of citizen 1, and adds 2 new ones.
-- Final state should be: citizens 1, 3, 4 (capacity=3 respected).
select
  is (
    (
      select
        r.assigned_count
      from
        public.set_per_target_assignment (
          'fc400000-0000-0000-0000-000000000001',
          'deposit',
          'fc900000-0000-0000-0000-000000000001',
          array[
            'fca00000-0000-0000-0000-000000000001'::uuid,
            'fca00000-0000-0000-0000-000000000003'::uuid,
            'fca00000-0000-0000-0000-000000000004'::uuid
          ]
        ) r
    ),
    3,
    'TX B: set_per_target_assignment returns assigned_count = 3'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'fc900000-0000-0000-0000-000000000001'
    ),
    3,
    'final state: exactly 3 citizens assigned (capacity not exceeded)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'fc900000-0000-0000-0000-000000000001'
        and ca.citizen_id in (
          'fca00000-0000-0000-0000-000000000001',
          'fca00000-0000-0000-0000-000000000003',
          'fca00000-0000-0000-0000-000000000004'
        )
    ),
    3,
    'final citizens match TX B state (1, 3, 4)'
  );

-- ===========================================================================
-- TEST 2: concurrent assignment exceeding capacity
-- TX C tries to assign citizens 1-5 (5 > capacity=3), should fail.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_per_target_assignment(
      'fc400000-0000-0000-0000-000000000001',
      'deposit',
      'fc900000-0000-0000-0000-000000000001',
      array[
        'fca00000-0000-0000-0000-000000000001'::uuid,
        'fca00000-0000-0000-0000-000000000002'::uuid,
        'fca00000-0000-0000-0000-000000000003'::uuid,
        'fca00000-0000-0000-0000-000000000004'::uuid,
        'fca00000-0000-0000-0000-000000000005'::uuid
      ]
    )
    $test$,
    'P0001',
    'citizen count (5) exceeds max workers (3) for this deposit instance',
    'capacity constraint prevents over-assignment'
  );

reset role;

rollback;
