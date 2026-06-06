-- pgTAP tests for public.set_bulk_standard_job_assignment RPC.
-- Run with: npx supabase test db
begin;

select
  plan (21);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ba-prefixed, unique to this file):
--   ba1xxxxx = users          ba2xxxxx = worlds
--   ba3xxxxx = nations        ba4xxxxx = settlements
--   ba5xxxxx = job_definitions ba6xxxxx = citizens
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
    'ba100000-0000-0000-0000-000000000001',
    'bsja-owner@example.com',
    'x',
    now(),
    '{"username":"bsja_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ba100000-0000-0000-0000-000000000002',
    'bsja-manager@example.com',
    'x',
    now(),
    '{"username":"bsja_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'ba100000-0000-0000-0000-000000000003',
    'bsja-outsider@example.com',
    'x',
    now(),
    '{"username":"bsja_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'ba100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ba200000-0000-0000-0000-000000000001',
    'BSJA World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ba300000-0000-0000-0000-000000000001',
    'ba200000-0000-0000-0000-000000000001',
    'BSJA Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ba400000-0000-0000-0000-000000000001',
    'ba300000-0000-0000-0000-000000000001',
    'BSJA Settlement'
  );

-- Job definitions:
--   ba5...001 = standard, base_capacity=5 (main test target)
--   ba5...002 = construction, base_capacity=3 (non-standard for rejection test)
--   ba5...003 = standard, is_trashed=true (trashed job rejection test)
--   ba5...004 = standard, base_capacity=10 (absorber for insufficient-NPC test)
insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    is_trashed
  )
values
  (
    'ba500000-0000-0000-0000-000000000001',
    'ba200000-0000-0000-0000-000000000001',
    'BSJA Farming',
    'bsja-farming',
    'standard',
    5,
    false
  ),
  (
    'ba500000-0000-0000-0000-000000000002',
    'ba200000-0000-0000-0000-000000000001',
    'BSJA Construction',
    'bsja-construction',
    'construction',
    3,
    false
  ),
  (
    'ba500000-0000-0000-0000-000000000003',
    'ba200000-0000-0000-0000-000000000001',
    'BSJA Old Job',
    'bsja-old-job',
    'standard',
    5,
    true
  ),
  (
    'ba500000-0000-0000-0000-000000000004',
    'ba200000-0000-0000-0000-000000000001',
    'BSJA Absorber',
    'bsja-absorber',
    'standard',
    10,
    false
  );

-- Citizens:
--   ba6...001-005, ba6...007 = NPCs
--   ba6...006 = PC (settlement manager, linked to user ba1...002)
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
    role_settlement_id
  )
values
  (
    'ba600000-0000-0000-0000-000000000001',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'BSJA NPC 1',
    'alive',
    null,
    'none',
    null
  ),
  (
    'ba600000-0000-0000-0000-000000000002',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'BSJA NPC 2',
    'alive',
    null,
    'none',
    null
  ),
  (
    'ba600000-0000-0000-0000-000000000003',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'BSJA NPC 3',
    'alive',
    null,
    'none',
    null
  ),
  (
    'ba600000-0000-0000-0000-000000000004',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'BSJA NPC 4',
    'alive',
    null,
    'none',
    null
  ),
  (
    'ba600000-0000-0000-0000-000000000005',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'BSJA NPC 5',
    'alive',
    null,
    'none',
    null
  ),
  (
    'ba600000-0000-0000-0000-000000000006',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'player_character',
    'BSJA PC Manager',
    'alive',
    'ba100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'ba400000-0000-0000-0000-000000000001'
  ),
  (
    'ba600000-0000-0000-0000-000000000007',
    'ba200000-0000-0000-0000-000000000001',
    'ba400000-0000-0000-0000-000000000001',
    'npc',
    'BSJA NPC 7',
    'alive',
    null,
    'none',
    null
  );

-- Initial citizen_assignments: NPCs 001-003 assigned to ba5...001 = count 3
-- Unassigned alive NPCs: ba6...004, 005, 007
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'ba600000-0000-0000-0000-000000000001',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000002',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000003',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
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
        proname = 'set_bulk_standard_job_assignment'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_bulk_standard_job_assignment is SECURITY DEFINER'
  );

-- ===========================================================================
-- NO-OP: target = current (3)
-- Both SELECT calls invoke the RPC independently; both are no-ops.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_bulk_standard_job_assignment (
          'ba400000-0000-0000-0000-000000000001',
          'ba500000-0000-0000-0000-000000000001',
          3
        ) r
    ),
    3,
    'no-op: before = 3'
  );

select
  is (
    (
      select
        r.after
      from
        public.set_bulk_standard_job_assignment (
          'ba400000-0000-0000-0000-000000000001',
          'ba500000-0000-0000-0000-000000000001',
          3
        ) r
    ),
    3,
    'no-op: after = 3'
  );

-- ===========================================================================
-- ADMIN RAISE: 3 → 5 (adds 2 NPCs; unassigned NPCs: 004, 005, 007)
-- The SELECT below invokes the RPC once; state becomes count=5.
-- ===========================================================================
select
  is (
    (
      select
        r.before
      from
        public.set_bulk_standard_job_assignment (
          'ba400000-0000-0000-0000-000000000001',
          'ba500000-0000-0000-0000-000000000001',
          5
        ) r
    ),
    3,
    'admin raise: before = 3'
  );

reset role;

-- State is count=5. Verify via direct table read (as postgres superuser).
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
        join public.citizens c on c.id = ca.citizen_id
      where
        ca.job_id = 'ba500000-0000-0000-0000-000000000001'
        and c.settlement_id = 'ba400000-0000-0000-0000-000000000001'
    ),
    5,
    'admin raise: citizen_assignments count = 5'
  );

-- ===========================================================================
-- ADMIN LOWER: 5 → 3 (state from raise above, count=5)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_bulk_standard_job_assignment (
          'ba400000-0000-0000-0000-000000000001',
          'ba500000-0000-0000-0000-000000000001',
          3
        ) r
    ),
    5,
    'admin lower: before = 5'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
        join public.citizens c on c.id = ca.citizen_id
      where
        ca.job_id = 'ba500000-0000-0000-0000-000000000001'
        and c.settlement_id = 'ba400000-0000-0000-0000-000000000001'
    ),
    3,
    'admin lower: count = 3 after lower'
  );

-- ===========================================================================
-- ADMIN LOWER random: reset to 4 NPCs (001-004) = count 4, lower to 2
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002',
    'ba600000-0000-0000-0000-000000000003',
    'ba600000-0000-0000-0000-000000000004',
    'ba600000-0000-0000-0000-000000000005',
    'ba600000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'ba600000-0000-0000-0000-000000000001',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000002',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000003',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000004',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'admin lower random: RPC succeeds'
  );

reset role;

-- ===========================================================================
-- REJECTION: trigger blocks PC direct insert into citizen_assignments
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, assigned_on_turn_number
    ) values (
      'ba600000-0000-0000-0000-000000000006',
      'standard_job',
      'ba500000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'P0001',
    null,
    'trigger rejects direct PC insert into citizen_assignments'
  );

-- ===========================================================================
-- REJECTION: target > capacity (base_capacity = 5)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      6
    )
    $test$,
    'P0001',
    null,
    'target > capacity is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: trashed job
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000003',
      1
    )
    $test$,
    'P0001',
    null,
    'trashed job is rejected with P0001'
  );

-- ===========================================================================
-- ACCEPTANCE: construction-typed job
-- §20260604000008 merged construction into set_bulk_standard_job_assignment so
-- the single RPC handles both standard and construction job types.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000002',
      1
    )
    $test$,
    'construction-typed job is accepted by the merged RPC'
  );

-- ===========================================================================
-- REJECTION: negative target count
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      -1
    )
    $test$,
    'P0001',
    null,
    'negative target count is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- REJECTION: insufficient unassigned NPCs
-- Full reset: all 6 NPCs absorbed into ba5...004; 0 unassigned NPCs.
-- Try to raise ba5...001 to 1 → P0001.
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002',
    'ba600000-0000-0000-0000-000000000003',
    'ba600000-0000-0000-0000-000000000004',
    'ba600000-0000-0000-0000-000000000005',
    'ba600000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'ba600000-0000-0000-0000-000000000001',
    'standard_job',
    'ba500000-0000-0000-0000-000000000004',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000002',
    'standard_job',
    'ba500000-0000-0000-0000-000000000004',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000003',
    'standard_job',
    'ba500000-0000-0000-0000-000000000004',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000004',
    'standard_job',
    'ba500000-0000-0000-0000-000000000004',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000005',
    'standard_job',
    'ba500000-0000-0000-0000-000000000004',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000007',
    'standard_job',
    'ba500000-0000-0000-0000-000000000004',
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'P0001',
    null,
    'raise with no unassigned NPCs is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: anonymous caller
-- ===========================================================================
reset role;

set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: authenticated outsider (no settlement access)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- Reset for manager tests: 1 NPC (001) = count 1
-- Free NPCs: 002, 003, 004, 005, 007 (released from absorber)
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002',
    'ba600000-0000-0000-0000-000000000003',
    'ba600000-0000-0000-0000-000000000004',
    'ba600000-0000-0000-0000-000000000005',
    'ba600000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'ba600000-0000-0000-0000-000000000001',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  );

-- ===========================================================================
-- MANAGER RAISE: settlement manager can raise count (1 → 2)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'settlement manager can raise count'
  );

-- ===========================================================================
-- MANAGER LOWER: settlement manager can lower count (2 → 1)
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'settlement manager can lower count'
  );

reset role;

-- ===========================================================================
-- get_settlement_standard_job_counts: alive filter (defense-in-depth)
--
-- Set up: NPC 001 and NPC 002 assigned to ba5...001 (standard, capacity=5).
-- Mark NPC 001 as dead (status = 'dead') without touching citizen_assignments —
-- simulating a missed cleanup (the scenario the alive filter guards against).
-- Verify that get_settlement_standard_job_counts reports current_count = 1,
-- not 2.
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002',
    'ba600000-0000-0000-0000-000000000003',
    'ba600000-0000-0000-0000-000000000004',
    'ba600000-0000-0000-0000-000000000005',
    'ba600000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'ba600000-0000-0000-0000-000000000001',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  ),
  (
    'ba600000-0000-0000-0000-000000000002',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  );

-- Mark NPC 001 as dead without deleting their assignment (simulates missed cleanup).
update public.citizens
set
  status = 'dead',
  death_cause_category = 'manual_admin',
  death_cause = 'test fixture'
where
  id = 'ba600000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.current_count
      from
        public.get_settlement_standard_job_counts ('ba400000-0000-0000-0000-000000000001') r
      where
        r.job_id = 'ba500000-0000-0000-0000-000000000001'
    ),
    1,
    'get_settlement_standard_job_counts: dead NPC assignment does not inflate count'
  );

reset role;

-- Restore NPC 001 to alive for cleanliness.
update public.citizens
set
  status = 'alive',
  death_cause_category = null,
  death_cause = null
where
  id = 'ba600000-0000-0000-0000-000000000001';

-- ===========================================================================
-- get_settlement_standard_job_counts: alive count after all NPCs marked dead
-- ===========================================================================
update public.citizens
set
  status = 'dead',
  death_cause_category = 'manual_admin',
  death_cause = 'test fixture'
where
  id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.current_count
      from
        public.get_settlement_standard_job_counts ('ba400000-0000-0000-0000-000000000001') r
      where
        r.job_id = 'ba500000-0000-0000-0000-000000000001'
    ),
    0,
    'get_settlement_standard_job_counts: all assigned NPCs dead yields count = 0'
  );

reset role;

-- Restore for safety.
update public.citizens
set
  status = 'alive',
  death_cause_category = null,
  death_cause = null
where
  id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- get_settlement_standard_job_counts: alive NPC still counted correctly
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ba100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.current_count
      from
        public.get_settlement_standard_job_counts ('ba400000-0000-0000-0000-000000000001') r
      where
        r.job_id = 'ba500000-0000-0000-0000-000000000001'
    ),
    2,
    'get_settlement_standard_job_counts: alive assigned NPCs are counted correctly'
  );

reset role;

select
  *
from
  finish ();

rollback;
