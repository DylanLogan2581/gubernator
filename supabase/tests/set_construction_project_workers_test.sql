-- pgTAP tests for public.set_construction_project_workers RPC.
-- Run with: npx supabase test db
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all bce-prefixed, unique to this file):
--   bce1xxxxx = users          bce2xxxxx = worlds
--   bce3xxxxx = nations        bce4xxxxx = settlements
--   bce5xxxxx = blueprints     bce6xxxxx = tiers
--   bce7xxxxx = projects       bce8xxxxx = citizens
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
    'bce10000-0000-0000-0000-000000000001',
    'bcewrk-owner@example.com',
    'x',
    now(),
    '{"username":"bcewrk_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'bce10000-0000-0000-0000-000000000002',
    'bcewrk-worldadmin@example.com',
    'x',
    now(),
    '{"username":"bcewrk_worldadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'bce10000-0000-0000-0000-000000000003',
    'bcewrk-manager@example.com',
    'x',
    now(),
    '{"username":"bcewrk_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'bce10000-0000-0000-0000-000000000004',
    'bcewrk-outsider@example.com',
    'x',
    now(),
    '{"username":"bcewrk_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'bce10000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'bce20000-0000-0000-0000-000000000001',
    'BCE World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'bce20000-0000-0000-0000-000000000001',
    'bce10000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'bce30000-0000-0000-0000-000000000001',
    'bce20000-0000-0000-0000-000000000001',
    'BCE Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'bce40000-0000-0000-0000-000000000001',
    'bce30000-0000-0000-0000-000000000001',
    'BCE Settlement'
  );

-- Building blueprint + tier needed for a valid project
insert into
  public.building_blueprints (id, world_id, name, slug, grace_period_turns)
values
  (
    'bce50000-0000-0000-0000-000000000001',
    'bce20000-0000-0000-0000-000000000001',
    'BCE Blueprint',
    'bce-blueprint',
    0
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required,
    construction_costs_json,
    upkeep_costs_json,
    effects_json
  )
values
  (
    'bce60000-0000-0000-0000-000000000001',
    'bce50000-0000-0000-0000-000000000001',
    1,
    10,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );

insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position,
    progress_worker_turns
  )
values
  (
    'bce70000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'bce50000-0000-0000-0000-000000000001',
    'bce60000-0000-0000-0000-000000000001',
    'queued',
    1,
    0
  );

-- Citizens: NPCs 001-005, PC manager (linked to user 003), PC outsider
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
    'bce80000-0000-0000-0000-000000000001',
    'bce20000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'npc',
    'BCE NPC 1',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bce80000-0000-0000-0000-000000000002',
    'bce20000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'npc',
    'BCE NPC 2',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bce80000-0000-0000-0000-000000000003',
    'bce20000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'npc',
    'BCE NPC 3',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bce80000-0000-0000-0000-000000000004',
    'bce20000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'npc',
    'BCE NPC 4',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bce80000-0000-0000-0000-000000000005',
    'bce20000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'npc',
    'BCE NPC 5',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'bce80000-0000-0000-0000-000000000006',
    'bce20000-0000-0000-0000-000000000001',
    'bce40000-0000-0000-0000-000000000001',
    'player_character',
    'BCE PC Manager',
    'alive',
    'bce10000-0000-0000-0000-000000000003',
    'settlement_manager',
    null,
    'bce40000-0000-0000-0000-000000000001'
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
        proname = 'set_construction_project_workers'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_construction_project_workers is SECURITY DEFINER'
  );

-- ===========================================================================
-- NO-OP: target = current (0) — no assignments yet
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.before
      from
        public.set_construction_project_workers ('bce70000-0000-0000-0000-000000000001', 0) r
    ),
    0,
    'no-op: before = 0'
  );

select
  is (
    (
      select
        r.after
      from
        public.set_construction_project_workers ('bce70000-0000-0000-0000-000000000001', 0) r
    ),
    0,
    'no-op: after = 0'
  );

-- ===========================================================================
-- RAISE: 0 → 3 (adds 3 NPCs)
-- ===========================================================================
select
  is (
    (
      select
        r.before
      from
        public.set_construction_project_workers ('bce70000-0000-0000-0000-000000000001', 3) r
    ),
    0,
    'raise: before = 0'
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
        and ca.construction_project_id = 'bce70000-0000-0000-0000-000000000001'
    ),
    3,
    'raise: project now has 3 assigned workers'
  );

-- ===========================================================================
-- LOWER: 3 → 1
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        r.after
      from
        public.set_construction_project_workers ('bce70000-0000-0000-0000-000000000001', 1) r
    ),
    1,
    'lower: after = 1'
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
        and ca.construction_project_id = 'bce70000-0000-0000-0000-000000000001'
    ),
    1,
    'lower: project now has 1 assigned worker'
  );

-- ===========================================================================
-- REJECTION: negative target count
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_construction_project_workers(
      'bce70000-0000-0000-0000-000000000001',
      -1
    )
    $test$,
    'P0001',
    null,
    'negative target count is rejected with P0001'
  );

-- ===========================================================================
-- REJECTION: insufficient unassigned NPCs
-- Assign all 5 NPCs to the project, then try to raise to 6.
-- ===========================================================================
reset role;

delete from public.citizen_assignments
where
  citizen_id in (
    'bce80000-0000-0000-0000-000000000001',
    'bce80000-0000-0000-0000-000000000002',
    'bce80000-0000-0000-0000-000000000003',
    'bce80000-0000-0000-0000-000000000004',
    'bce80000-0000-0000-0000-000000000005'
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
    'bce80000-0000-0000-0000-000000000001',
    'construction_project',
    'bce70000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bce80000-0000-0000-0000-000000000002',
    'construction_project',
    'bce70000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bce80000-0000-0000-0000-000000000003',
    'construction_project',
    'bce70000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bce80000-0000-0000-0000-000000000004',
    'construction_project',
    'bce70000-0000-0000-0000-000000000001',
    1
  ),
  (
    'bce80000-0000-0000-0000-000000000005',
    'construction_project',
    'bce70000-0000-0000-0000-000000000001',
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_construction_project_workers(
      'bce70000-0000-0000-0000-000000000001',
      6
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
    select public.set_construction_project_workers(
      'bce70000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- REJECTION: outsider (no settlement access)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_construction_project_workers(
      'bce70000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

-- ===========================================================================
-- WORLD ADMIN: can set project workers
-- Reset: clear all assignments first
-- ===========================================================================
reset role;

delete from public.citizen_assignments
where
  citizen_id in (
    'bce80000-0000-0000-0000-000000000001',
    'bce80000-0000-0000-0000-000000000002',
    'bce80000-0000-0000-0000-000000000003',
    'bce80000-0000-0000-0000-000000000004',
    'bce80000-0000-0000-0000-000000000005'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_construction_project_workers(
      'bce70000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'world admin can set construction project workers'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: can set project workers
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"bce10000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_construction_project_workers(
      'bce70000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'settlement manager can set construction project workers'
  );

reset role;

select
  *
from
  finish ();

rollback;
