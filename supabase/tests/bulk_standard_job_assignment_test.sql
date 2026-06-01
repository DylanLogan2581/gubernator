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
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'ba200000-0000-0000-0000-000000000001',
    'BSJA World',
    'ba100000-0000-0000-0000-000000000001',
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
    name,
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

-- Initial citizen_assignments: NPCs 001-003 + PC 006 assigned to ba5...001 = count 4
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
  ),
  (
    'ba600000-0000-0000-0000-000000000006',
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
-- NO-OP: target = current (4)
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
          4,
          'npc_first'
        ) r
    ),
    4,
    'no-op: before = 4'
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
          4,
          'npc_first'
        ) r
    ),
    4,
    'no-op: after = 4'
  );

-- ===========================================================================
-- ADMIN RAISE: 4 → 5 (adds 1 NPC; unassigned NPCs: 004, 005, 007)
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
          5,
          'npc_first'
        ) r
    ),
    4,
    'admin raise: before = 4'
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

-- Raise must only add NPCs; PC (ba6...006) must not gain a duplicate row.
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'ba600000-0000-0000-0000-000000000006'
    ),
    1,
    'admin raise: PC ba6...006 has exactly one assignment (only NPCs added)'
  );

-- ===========================================================================
-- ADMIN LOWER npc_first: 5 → 3 (state from raise above, count=5)
-- NPCs removed before PC; PC (ba6...006) must survive.
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
          3,
          'npc_first'
        ) r
    ),
    5,
    'admin lower npc_first: before = 5'
  );

reset role;

-- PC (ba6...006) must still be assigned (NPC-first removes NPCs before PCs).
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'ba600000-0000-0000-0000-000000000006'
    ),
    1,
    'npc_first: PC ba6...006 preserved (PC-last invariant)'
  );

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
    'npc_first: count = 3 after lower'
  );

-- ===========================================================================
-- Reset for random lower test: 4 NPCs (001-004) + PC 006 = count 5
-- Unassigned NPCs: 005, 007
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002',
    'ba600000-0000-0000-0000-000000000003',
    'ba600000-0000-0000-0000-000000000004',
    'ba600000-0000-0000-0000-000000000005',
    'ba600000-0000-0000-0000-000000000006',
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
  ),
  (
    'ba600000-0000-0000-0000-000000000006',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  );

-- ===========================================================================
-- ADMIN LOWER random: 5 → 3 — 2 NPCs removed (PC-last; 4 NPCs ranked before PC)
-- ===========================================================================
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
      3,
      'random'
    )
    $test$,
    'admin lower random: RPC succeeds'
  );

reset role;

-- PC (ba6...006) must still be assigned: 2 NPCs were removed, not the PC.
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'ba600000-0000-0000-0000-000000000006'
    ),
    1,
    'random: PC ba6...006 preserved (PC-last invariant)'
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
      6,
      'npc_first'
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
      1,
      'npc_first'
    )
    $test$,
    'P0001',
    null,
    'trashed job is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: non-standard job (construction)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000002',
      1,
      'npc_first'
    )
    $test$,
    'P0001',
    null,
    'non-standard job (construction) is rejected with P0001'
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
      -1,
      'npc_first'
    )
    $test$,
    'P0001',
    null,
    'negative target count is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: invalid removal strategy
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      2,
      'biggest_first'
    )
    $test$,
    'P0001',
    null,
    'invalid removal strategy is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- REJECTION: insufficient unassigned NPCs
-- Full reset: all 6 NPCs absorbed into ba5...004; only PC in ba5...001.
-- current_count = 1 for ba5...001 (just PC); 0 unassigned NPCs.
-- Try to raise ba5...001 to 2 → P0001.
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'ba600000-0000-0000-0000-000000000001',
    'ba600000-0000-0000-0000-000000000002',
    'ba600000-0000-0000-0000-000000000003',
    'ba600000-0000-0000-0000-000000000004',
    'ba600000-0000-0000-0000-000000000005',
    'ba600000-0000-0000-0000-000000000006',
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
  ),
  (
    'ba600000-0000-0000-0000-000000000006',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
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
      2,
      'npc_first'
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
      1,
      'npc_first'
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
      1,
      'npc_first'
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- Reset for manager tests: 1 NPC (001) + PC (006) = count 2
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
    'ba600000-0000-0000-0000-000000000006',
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
    'ba600000-0000-0000-0000-000000000006',
    'standard_job',
    'ba500000-0000-0000-0000-000000000001',
    1
  );

-- ===========================================================================
-- MANAGER RAISE: settlement manager can raise count (2 → 3)
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
      3,
      'npc_first'
    )
    $test$,
    'settlement manager can raise count'
  );

-- ===========================================================================
-- MANAGER LOWER: settlement manager can lower count (3 → 2)
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.set_bulk_standard_job_assignment(
      'ba400000-0000-0000-0000-000000000001',
      'ba500000-0000-0000-0000-000000000001',
      2,
      'npc_first'
    )
    $test$,
    'settlement manager can lower count'
  );

reset role;

select
  *
from
  finish ();

rollback;
