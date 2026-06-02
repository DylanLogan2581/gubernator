-- pgTAP tests for public.set_bulk_construction_assignment RPC.
-- Run with: npx supabase test db
begin;

select
  plan (17);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all bc-prefixed, unique to this file):
--   bc1xxxxx = users          bc2xxxxx = worlds
--   bc3xxxxx = nations        bc4xxxxx = settlements
--   bc5xxxxx = blueprints     bc6xxxxx = blueprint tiers
--   bc7xxxxx = projects       bc8xxxxx = citizens
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
    'bc100000-0000-0000-0000-000000000001',
    'bcja-owner@example.com',
    'x',
    now(),
    '{"username":"bcja_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'bc100000-0000-0000-0000-000000000002',
    'bcja-manager@example.com',
    'x',
    now(),
    '{"username":"bcja_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'bc100000-0000-0000-0000-000000000003',
    'bcja-outsider@example.com',
    'x',
    now(),
    '{"username":"bcja_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'bc100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'bc200000-0000-0000-0000-000000000001',
    'BCJA World',
    'bc100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'bc300000-0000-0000-0000-000000000001',
    'bc200000-0000-0000-0000-000000000001',
    'BCJA Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'bc400000-0000-0000-0000-000000000001',
    'bc300000-0000-0000-0000-000000000001',
    'BCJA Settlement'
  );

-- Building blueprint and tier (required to create construction_projects)
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'bc500000-0000-0000-0000-000000000001',
    'bc200000-0000-0000-0000-000000000001',
    'BCJA Barracks',
    'bcja-barracks'
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
    'bc600000-0000-0000-0000-000000000001',
    'bc500000-0000-0000-0000-000000000001',
    1,
    10
  );

-- Construction projects:
--   bc7...001 = in_progress (main test target)
--   bc7...002 = complete (terminal rejection test)
--   bc7...003 = cancelled (terminal rejection test)
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
    'bc700000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'bc500000-0000-0000-0000-000000000001',
    'bc600000-0000-0000-0000-000000000001',
    'in_progress',
    1
  ),
  (
    'bc700000-0000-0000-0000-000000000002',
    'bc400000-0000-0000-0000-000000000001',
    'bc500000-0000-0000-0000-000000000001',
    'bc600000-0000-0000-0000-000000000001',
    'complete',
    999
  ),
  (
    'bc700000-0000-0000-0000-000000000003',
    'bc400000-0000-0000-0000-000000000001',
    'bc500000-0000-0000-0000-000000000001',
    'bc600000-0000-0000-0000-000000000001',
    'cancelled',
    998
  );

-- Citizens:
--   bc8...001-005, bc8...007 = NPCs
--   bc8...006 = PC (settlement manager, linked to user bc1...002)
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
    'bc800000-0000-0000-0000-000000000001',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'npc',
    'BCJA NPC 1',
    'alive',
    null,
    'none',
    null
  ),
  (
    'bc800000-0000-0000-0000-000000000002',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'npc',
    'BCJA NPC 2',
    'alive',
    null,
    'none',
    null
  ),
  (
    'bc800000-0000-0000-0000-000000000003',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'npc',
    'BCJA NPC 3',
    'alive',
    null,
    'none',
    null
  ),
  (
    'bc800000-0000-0000-0000-000000000004',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'npc',
    'BCJA NPC 4',
    'alive',
    null,
    'none',
    null
  ),
  (
    'bc800000-0000-0000-0000-000000000005',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'npc',
    'BCJA NPC 5',
    'alive',
    null,
    'none',
    null
  ),
  (
    'bc800000-0000-0000-0000-000000000006',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'player_character',
    'BCJA PC Manager',
    'alive',
    'bc100000-0000-0000-0000-000000000002',
    'settlement_manager',
    'bc400000-0000-0000-0000-000000000001'
  ),
  (
    'bc800000-0000-0000-0000-000000000007',
    'bc200000-0000-0000-0000-000000000001',
    'bc400000-0000-0000-0000-000000000001',
    'npc',
    'BCJA NPC 7',
    'alive',
    null,
    'none',
    null
  );

-- Initial citizen_assignments: NPCs 001-003 assigned to bc7...001 = count 3
-- Unassigned alive NPCs: bc8...004, 005, 007
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'bc800000-0000-0000-0000-000000000001',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000002',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000003',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
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
        proname = 'set_bulk_construction_assignment'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_bulk_construction_assignment is SECURITY DEFINER'
  );

-- ===========================================================================
-- NO-OP: target = current (3)
-- Both SELECT calls invoke the RPC independently; both are no-ops.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_bulk_construction_assignment ('bc700000-0000-0000-0000-000000000001', 3) r
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
        public.set_bulk_construction_assignment ('bc700000-0000-0000-0000-000000000001', 3) r
    ),
    3,
    'no-op: after = 3'
  );

-- ===========================================================================
-- ADMIN RAISE: 3 → 5 (adds 2 NPCs; unassigned NPCs: 004, 005, 007)
-- ===========================================================================
select
  is (
    (
      select
        r.before
      from
        public.set_bulk_construction_assignment ('bc700000-0000-0000-0000-000000000001', 5) r
    ),
    3,
    'admin raise: before = 3'
  );

reset role;

-- Verify count via direct table read (as postgres superuser).
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.assignment_type = 'construction_project'
        and ca.construction_project_id = 'bc700000-0000-0000-0000-000000000001'
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
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_bulk_construction_assignment ('bc700000-0000-0000-0000-000000000001', 3) r
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
      where
        ca.assignment_type = 'construction_project'
        and ca.construction_project_id = 'bc700000-0000-0000-0000-000000000001'
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
    'bc800000-0000-0000-0000-000000000001',
    'bc800000-0000-0000-0000-000000000002',
    'bc800000-0000-0000-0000-000000000003',
    'bc800000-0000-0000-0000-000000000004',
    'bc800000-0000-0000-0000-000000000005',
    'bc800000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'bc800000-0000-0000-0000-000000000001',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000002',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000003',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000004',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
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
      citizen_id, assignment_type, construction_project_id, assigned_on_turn_number
    ) values (
      'bc800000-0000-0000-0000-000000000006',
      'construction_project',
      'bc700000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'P0001',
    null,
    'trigger rejects direct PC insert into citizen_assignments'
  );

-- ===========================================================================
-- REJECTION: complete project
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000002',
      1
    )
    $test$,
    'P0001',
    null,
    'complete project is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: cancelled project
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000003',
      1
    )
    $test$,
    'P0001',
    null,
    'cancelled project is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: negative target count
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
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
-- All 6 NPCs in bc7...001 (count=6); 0 unassigned NPCs.
-- Try to raise bc7...001 to 7 → P0001.
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'bc800000-0000-0000-0000-000000000001',
    'bc800000-0000-0000-0000-000000000002',
    'bc800000-0000-0000-0000-000000000003',
    'bc800000-0000-0000-0000-000000000004',
    'bc800000-0000-0000-0000-000000000005',
    'bc800000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'bc800000-0000-0000-0000-000000000001',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000002',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000003',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000004',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000005',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bc800000-0000-0000-0000-000000000007',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
      7
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
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
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
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
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
-- Free NPCs: 002, 003, 004, 005, 007
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'bc800000-0000-0000-0000-000000000001',
    'bc800000-0000-0000-0000-000000000002',
    'bc800000-0000-0000-0000-000000000003',
    'bc800000-0000-0000-0000-000000000004',
    'bc800000-0000-0000-0000-000000000005',
    'bc800000-0000-0000-0000-000000000007'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'bc800000-0000-0000-0000-000000000001',
    'construction_project',
    'bc700000-0000-0000-0000-000000000001',
    1
  );

-- ===========================================================================
-- MANAGER RAISE: settlement manager can raise count (1 → 2)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bc100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
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
    select public.set_bulk_construction_assignment(
      'bc700000-0000-0000-0000-000000000001',
      1
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
