-- pgTAP tests for public.reorder_construction_projects RPC.
-- Run with: npx supabase test db
begin;

select
  plan (11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all e-prefixed, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = blueprints     e6xxxxxx = tiers
--   e7xxxxxx = projects
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
    'rcp-superadmin@example.com',
    'x',
    now(),
    '{"username":"rcp_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'rcp-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"rcp_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'rcp-outsider@example.com',
    'x',
    now(),
    '{"username":"rcp_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'RCP World',
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
    'RCP Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'RCP Settlement'
  );

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
    role_settlement_id
  )
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'player_character',
    'RCP Settlement Manager PC',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'settlement_manager',
    null,
    'e4000000-0000-0000-0000-000000000001'
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
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'RCP Granary',
    'granary-rcp',
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
  );

-- Three non-terminal projects at positions 1, 2, 3; one cancelled (ignored)
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
    'e7000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'queued',
    1,
    0
  ),
  (
    'e7000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'in_progress',
    2,
    5
  ),
  (
    'e7000000-0000-0000-0000-000000000003',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'paused',
    3,
    2
  ),
  (
    'e7000000-0000-0000-0000-000000000004',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'cancelled',
    4,
    0
  );

-- ===========================================================================
-- SUPER ADMIN: reorder all three non-terminal projects — returns updated_count=3
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        updated_count
      from
        public.reorder_construction_projects (
          'e4000000-0000-0000-0000-000000000001',
          '[
            {"projectId":"e7000000-0000-0000-0000-000000000003","position":1},
            {"projectId":"e7000000-0000-0000-0000-000000000001","position":2},
            {"projectId":"e7000000-0000-0000-0000-000000000002","position":3}
          ]'::jsonb
        )
    ),
    3,
    'super admin can reorder projects; returns updated_count=3'
  );

reset role;

-- ===========================================================================
-- Verify new positions were applied correctly
-- ===========================================================================
select
  is (
    (
      select
        queue_position
      from
        public.construction_projects
      where
        id = 'e7000000-0000-0000-0000-000000000003'
    ),
    1,
    'project e7...003 (paused) is now at queue_position 1'
  );

select
  is (
    (
      select
        queue_position
      from
        public.construction_projects
      where
        id = 'e7000000-0000-0000-0000-000000000001'
    ),
    2,
    'project e7...001 (queued) is now at queue_position 2'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: reorder (restore original order)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.reorder_construction_projects(
      'e4000000-0000-0000-0000-000000000001',
      '[
        {"projectId":"e7000000-0000-0000-0000-000000000001","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000002","position":2},
        {"projectId":"e7000000-0000-0000-0000-000000000003","position":3}
      ]'::jsonb
    )
    $test$,
    'settlement manager can reorder projects'
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
    select public.reorder_construction_projects(
      'e4000000-0000-0000-0000-000000000001',
      '[
        {"projectId":"e7000000-0000-0000-0000-000000000001","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000002","position":2},
        {"projectId":"e7000000-0000-0000-0000-000000000003","position":3}
      ]'::jsonb
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
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reorder_construction_projects(
      'e4000000-0000-0000-0000-000000000001',
      '[
        {"projectId":"e7000000-0000-0000-0000-000000000001","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000002","position":2},
        {"projectId":"e7000000-0000-0000-0000-000000000003","position":3}
      ]'::jsonb
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- GAP REJECTED: positions [1, 2, 4] for 3 projects — position 4 is out of the
-- 1..N range (N=3); position 3 is missing, creating a gap.
-- (use admin context for remaining validation tests)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reorder_construction_projects(
      'e4000000-0000-0000-0000-000000000001',
      '[
        {"projectId":"e7000000-0000-0000-0000-000000000001","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000002","position":2},
        {"projectId":"e7000000-0000-0000-0000-000000000003","position":4}
      ]'::jsonb
    )
    $test$,
    'P0001',
    null,
    'positions with a gap (out-of-range value) are rejected with P0001'
  );

-- ===========================================================================
-- DUPLICATE POSITION REJECTED: positions [1, 1, 3] for 3 projects
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.reorder_construction_projects(
      'e4000000-0000-0000-0000-000000000001',
      '[
        {"projectId":"e7000000-0000-0000-0000-000000000001","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000002","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000003","position":3}
      ]'::jsonb
    )
    $test$,
    'P0001',
    null,
    'duplicate position values are rejected with P0001'
  );

-- ===========================================================================
-- PARTIAL COVERAGE REJECTED: only 2 entries for 3 non-terminal projects
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.reorder_construction_projects(
      'e4000000-0000-0000-0000-000000000001',
      '[
        {"projectId":"e7000000-0000-0000-0000-000000000001","position":1},
        {"projectId":"e7000000-0000-0000-0000-000000000002","position":2}
      ]'::jsonb
    )
    $test$,
    'P0001',
    null,
    'partial coverage (missing a non-terminal project) is rejected with P0001'
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
        proname = 'reorder_construction_projects'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'reorder_construction_projects is SECURITY DEFINER'
  );

-- ===========================================================================
-- Return value shape: updated_count is 0 for an empty queue
-- ===========================================================================
insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000001',
    'RCP Empty Settlement'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        updated_count
      from
        public.reorder_construction_projects (
          'e4000000-0000-0000-0000-000000000002',
          '[]'::jsonb
        )
    ),
    0,
    'reorder on empty queue returns updated_count=0'
  );

reset role;

select
  *
from
  finish ();

rollback;
