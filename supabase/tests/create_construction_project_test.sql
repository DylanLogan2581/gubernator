-- pgTAP tests for public.create_construction_project RPC.
-- Run with: npx supabase test db
begin;

select
  plan (14);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all e-prefixed, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = blueprints     e6xxxxxx = tiers
--   e7xxxxxx = projects       e8xxxxxx = citizens
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
    'ccp-owner@example.com',
    'x',
    now(),
    '{"username":"ccp_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'ccp-world-admin@example.com',
    'x',
    now(),
    '{"username":"ccp_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'ccp-superadmin@example.com',
    'x',
    now(),
    '{"username":"ccp_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'ccp-nation-manager@example.com',
    'x',
    now(),
    '{"username":"ccp_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'ccp-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"ccp_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000006',
    'ccp-outsider@example.com',
    'x',
    now(),
    '{"username":"ccp_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000003';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'CCP World',
    'private',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'CCP Other World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'CCP Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'CCP Settlement'
  );

insert into
  public.building_blueprints (
    id,
    world_id,
    name,
    slug,
    max_instances_per_settlement,
    is_trashed
  )
values
  -- Uncapped blueprint for general tests
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Watchtower',
    'watchtower-ccp',
    null,
    false
  ),
  -- Capped blueprint (max 1) for instance-limit test
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Keep',
    'keep-ccp',
    1,
    false
  ),
  -- Trashed blueprint
  (
    'e5000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000001',
    'Ruined Hall',
    'ruined-hall-ccp',
    null,
    true
  ),
  -- Blueprint in the other world (for cross-world rejection)
  (
    'e5000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000002',
    'Other World Tower',
    'other-world-tower-ccp',
    null,
    false
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
    'e6000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    1,
    10
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e5000000-0000-0000-0000-000000000002',
    1,
    20
  ),
  -- Tier belonging to a different blueprint (for tier-mismatch test)
  (
    'e6000000-0000-0000-0000-000000000003',
    'e5000000-0000-0000-0000-000000000004',
    1,
    5
  );

-- Citizens for role-based tests
insert into
  public.citizens (
    id,
    world_id,
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
    'e8000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'CCP Nation Manager PC',
    'alive',
    'e1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'e3000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'e8000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'CCP Settlement Manager PC',
    'alive',
    'e1000000-0000-0000-0000-000000000005',
    'settlement_manager',
    null,
    'e4000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- WORLD OWNER (implicit world admin): success — first project gets queue_position=1
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.create_construction_project (
            'e4000000-0000-0000-0000-000000000001',
            'e5000000-0000-0000-0000-000000000001',
            'e6000000-0000-0000-0000-000000000001'
          )
        ).queue_position
    ),
    1,
    'world owner can create a construction project; queue_position starts at 1'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: success — second project gets queue_position=2
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.create_construction_project (
            'e4000000-0000-0000-0000-000000000001',
            'e5000000-0000-0000-0000-000000000001',
            'e6000000-0000-0000-0000-000000000001'
          )
        ).queue_position
    ),
    2,
    'world admin can create a project; queue_position increments to 2'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'super admin can create a construction project'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'nation manager can create a construction project'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'settlement manager can create a construction project'
  );

reset role;

-- ===========================================================================
-- Verify newly created project has status='queued' and progress=0
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.construction_projects
      where
        settlement_id = 'e4000000-0000-0000-0000-000000000001'
        and building_blueprint_id = 'e5000000-0000-0000-0000-000000000001'
      order by
        queue_position
      limit
        1
    ),
    'queued',
    'newly created project has status queued'
  );

select
  is (
    (
      select
        progress_worker_turns
      from
        public.construction_projects
      where
        settlement_id = 'e4000000-0000-0000-0000-000000000001'
        and building_blueprint_id = 'e5000000-0000-0000-0000-000000000001'
      order by
        queue_position
      limit
        1
    ),
    0::numeric,
    'newly created project has progress_worker_turns=0'
  );

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
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- OUTSIDER (authenticated but no access): rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- TRASHED BLUEPRINT: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000003',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'P0001',
    null,
    'trashed blueprint is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- BLUEPRINT FROM ANOTHER WORLD: rejected (P0002)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000004',
      'e6000000-0000-0000-0000-000000000001'
    )
  $test$,
    'P0002',
    null,
    'blueprint from another world is rejected with P0002'
  );

reset role;

-- ===========================================================================
-- TIER FROM ANOTHER BLUEPRINT: rejected (P0002)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000003'
    )
  $test$,
    'P0002',
    null,
    'tier belonging to a different blueprint is rejected with P0002'
  );

reset role;

-- ===========================================================================
-- MAX INSTANCES EXCEEDED: rejected (P0001)
-- Keep blueprint has max_instances_per_settlement=1.
-- Insert one active settlement_building for the Keep, then attempt to create
-- a construction project for it — combined count (1+0) >= max (1) → P0001.
-- ===========================================================================
insert into
  public.settlement_buildings (
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    missed_upkeep_count,
    activated_on_turn_number
  )
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000002',
    'e6000000-0000-0000-0000-000000000002',
    'active',
    0,
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_construction_project(
      'e4000000-0000-0000-0000-000000000001',
      'e5000000-0000-0000-0000-000000000002',
      'e6000000-0000-0000-0000-000000000002'
    )
  $test$,
    '23514',
    null,
    'max instances exceeded (active building counts toward cap) rejected with 23514'
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
        proname = 'create_construction_project'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'create_construction_project is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
