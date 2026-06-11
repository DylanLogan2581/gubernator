-- pgTAP tests for public.set_bulk_construction_pool RPC.
-- Run with: npx supabase test db
begin;

select
  plan (18);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all bda-prefixed, unique to this file):
--   bda1xxxxx = users          bda2xxxxx = worlds
--   bda3xxxxx = nations        bda4xxxxx = settlements
--   bda8xxxxx = citizens
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
    'bda10000-0000-0000-0000-000000000001',
    'bdapool-owner@example.com',
    'x',
    now(),
    '{"username":"bdapool_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'bda10000-0000-0000-0000-000000000002',
    'bdapool-worldadmin@example.com',
    'x',
    now(),
    '{"username":"bdapool_worldadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'bda10000-0000-0000-0000-000000000003',
    'bdapool-manager@example.com',
    'x',
    now(),
    '{"username":"bdapool_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'bda10000-0000-0000-0000-000000000004',
    'bdapool-nation-manager@example.com',
    'x',
    now(),
    '{"username":"bdapool_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'bda10000-0000-0000-0000-000000000005',
    'bdapool-outsider@example.com',
    'x',
    now(),
    '{"username":"bdapool_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'bda10000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'bda20000-0000-0000-0000-000000000001',
    'BDA World',
    'private',
    'active'
  );

-- World admin for user 002
insert into
  public.world_admins (world_id, user_id)
values
  (
    'bda20000-0000-0000-0000-000000000001',
    'bda10000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'bda30000-0000-0000-0000-000000000001',
    'bda20000-0000-0000-0000-000000000001',
    'BDA Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'bda40000-0000-0000-0000-000000000001',
    'bda30000-0000-0000-0000-000000000001',
    'BDA Settlement'
  );

-- Citizens:
--   bda8...001-005, bda8...007 = NPCs
--   bda8...006 = PC settlement manager (linked to user 003)
--   bda8...008 = PC nation manager (linked to user 004)
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
    role_nation_id,
    role_settlement_id
  )
values
  (
    'bda80000-0000-0000-0000-000000000001',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'npc',
    'BDA NPC 1',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bda80000-0000-0000-0000-000000000002',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'npc',
    'BDA NPC 2',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bda80000-0000-0000-0000-000000000003',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'npc',
    'BDA NPC 3',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bda80000-0000-0000-0000-000000000004',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'npc',
    'BDA NPC 4',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bda80000-0000-0000-0000-000000000005',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'npc',
    'BDA NPC 5',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bda80000-0000-0000-0000-000000000006',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'player_character',
    'BDA PC Manager',
    'alive',
    'bda10000-0000-0000-0000-000000000003',
    'settlement_manager',
    null,
    'bda40000-0000-0000-0000-000000000001'
  ),
  (
    'bda80000-0000-0000-0000-000000000007',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'npc',
    'BDA NPC 7',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bda80000-0000-0000-0000-000000000008',
    'bda20000-0000-0000-0000-000000000001',
    'bda40000-0000-0000-0000-000000000001',
    'player_character',
    'BDA PC Nation Manager',
    'alive',
    'bda10000-0000-0000-0000-000000000004',
    'nation_manager',
    'bda30000-0000-0000-0000-000000000001',
    null
  );

-- Initial pool: NPCs 001-003 assigned as construction pool members
-- (construction_project_id = NULL — pool model)
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'bda80000-0000-0000-0000-000000000001',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000002',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000003',
    'construction_project',
    null,
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
        proname = 'set_bulk_construction_pool'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_bulk_construction_pool is SECURITY DEFINER'
  );

-- ===========================================================================
-- CONSTRAINT: construction_project with NULL construction_project_id is allowed
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, construction_project_id, assigned_on_turn_number
    ) values (
      'bda80000-0000-0000-0000-000000000004',
      'construction_project',
      null,
      1
    )
    $test$,
    'constraint allows pool row: construction_project with null construction_project_id'
  );

-- Clean up the constraint test row (restore to 3 pool members)
delete from public.citizen_assignments
where
  citizen_id = 'bda80000-0000-0000-0000-000000000004';

-- ===========================================================================
-- NO-OP: target = current (3)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_bulk_construction_pool ('bda40000-0000-0000-0000-000000000001', 3) r
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
        public.set_bulk_construction_pool ('bda40000-0000-0000-0000-000000000001', 3) r
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
        public.set_bulk_construction_pool ('bda40000-0000-0000-0000-000000000001', 5) r
    ),
    3,
    'admin raise: before = 3'
  );

reset role;

-- Verify pool count via direct table read (as postgres superuser).
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
        join public.citizens c on c.id = ca.citizen_id
      where
        ca.assignment_type = 'construction_project'
        and c.settlement_id = 'bda40000-0000-0000-0000-000000000001'
    ),
    5,
    'admin raise: pool count = 5'
  );

-- ===========================================================================
-- ADMIN LOWER: 5 → 3 (state from raise above, count = 5)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_bulk_construction_pool ('bda40000-0000-0000-0000-000000000001', 3) r
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
        ca.assignment_type = 'construction_project'
        and c.settlement_id = 'bda40000-0000-0000-0000-000000000001'
    ),
    3,
    'admin lower: pool count = 3 after lower'
  );

-- ===========================================================================
-- ADMIN LOWER random: reset to 4 NPCs (001-004), lower to 2
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'bda80000-0000-0000-0000-000000000001',
    'bda80000-0000-0000-0000-000000000002',
    'bda80000-0000-0000-0000-000000000003',
    'bda80000-0000-0000-0000-000000000004',
    'bda80000-0000-0000-0000-000000000005',
    'bda80000-0000-0000-0000-000000000007'
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
    'bda80000-0000-0000-0000-000000000001',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000002',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000003',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000004',
    'construction_project',
    null,
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
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
      'bda80000-0000-0000-0000-000000000006',
      'construction_project',
      null,
      1
    )
    $test$,
    'P0001',
    null,
    'trigger rejects direct PC insert into citizen_assignments'
  );

-- ===========================================================================
-- REJECTION: negative target count
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
      -1
    )
    $test$,
    'P0001',
    null,
    'negative target count is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: insufficient unassigned NPCs
-- All 6 NPCs assigned; try to raise to 7 → P0001.
-- ===========================================================================
reset role;

delete from public.citizen_assignments
where
  citizen_id in (
    'bda80000-0000-0000-0000-000000000001',
    'bda80000-0000-0000-0000-000000000002',
    'bda80000-0000-0000-0000-000000000003',
    'bda80000-0000-0000-0000-000000000004',
    'bda80000-0000-0000-0000-000000000005',
    'bda80000-0000-0000-0000-000000000007'
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
    'bda80000-0000-0000-0000-000000000001',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000002',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000003',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000004',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000005',
    'construction_project',
    null,
    1
  ),
  (
    'bda80000-0000-0000-0000-000000000007',
    'construction_project',
    null,
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
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
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
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
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

-- ===========================================================================
-- NATION MANAGER: allowed via current_user_manages_settlement
-- (is_nation_manager_of is included in current_user_manages_settlement)
-- State: 6 NPCs in pool, target = 6 (no-op)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
      6
    )
    $test$,
    'nation manager is allowed via current_user_manages_settlement'
  );

reset role;

-- ===========================================================================
-- Reset for world admin and manager tests: 1 NPC (001) in pool
-- Free NPCs: 002, 003, 004, 005, 007
-- ===========================================================================
delete from public.citizen_assignments
where
  citizen_id in (
    'bda80000-0000-0000-0000-000000000001',
    'bda80000-0000-0000-0000-000000000002',
    'bda80000-0000-0000-0000-000000000003',
    'bda80000-0000-0000-0000-000000000004',
    'bda80000-0000-0000-0000-000000000005',
    'bda80000-0000-0000-0000-000000000007'
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
    'bda80000-0000-0000-0000-000000000001',
    'construction_project',
    null,
    1
  );

-- ===========================================================================
-- WORLD ADMIN: can raise pool (1 → 2)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'world admin can raise pool count'
  );

-- ===========================================================================
-- MANAGER RAISE: settlement manager can raise pool (2 → 3)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"bda10000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
      3
    )
    $test$,
    'settlement manager can raise pool count'
  );

-- ===========================================================================
-- MANAGER LOWER: settlement manager can lower pool (3 → 1)
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.set_bulk_construction_pool(
      'bda40000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    'settlement manager can lower pool count'
  );

reset role;

select
  *
from
  finish ();

rollback;
