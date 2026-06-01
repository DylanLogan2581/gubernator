-- pgTAP tests for public.cancel_construction_project RPC.
-- Run with: npx supabase test db
begin;

select
  plan (11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all f-prefixed, unique to this file):
--   f1xxxxxx = users          f2xxxxxx = worlds
--   f3xxxxxx = nations        f4xxxxxx = settlements
--   f5xxxxxx = blueprints     f6xxxxxx = tiers
--   f7xxxxxx = projects       f8xxxxxx = citizens
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
    'f1000000-0000-0000-0000-000000000001',
    'cxp-superadmin@example.com',
    'x',
    now(),
    '{"username":"cxp_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'cxp-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"cxp_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'cxp-outsider@example.com',
    'x',
    now(),
    '{"username":"cxp_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1000000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'CXP World',
    'f1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CXP Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'CXP Settlement'
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
    'f8000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'CXP Settlement Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000002',
    'settlement_manager',
    null,
    'f4000000-0000-0000-0000-000000000001'
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
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CXP Watchtower',
    'watchtower-cxp',
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
    'f6000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    1,
    10
  );

-- Projects: queued (for admin cancel + cascade tests), in_progress (for manager cancel),
-- already-cancelled, already-complete
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
    'f7000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'queued',
    1,
    0
  ),
  (
    'f7000000-0000-0000-0000-000000000002',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'in_progress',
    2,
    5
  ),
  (
    'f7000000-0000-0000-0000-000000000003',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'cancelled',
    3,
    0
  ),
  (
    'f7000000-0000-0000-0000-000000000004',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'complete',
    4,
    10
  );

-- Assign a citizen to the queued project (to test cascade-unassign)
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'construction_project',
    'f7000000-0000-0000-0000-000000000001',
    1
  );

-- ===========================================================================
-- SUPER ADMIN: cancel queued project — returns unassigned_citizen_count = 1
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.cancel_construction_project ('f7000000-0000-0000-0000-000000000001')
        ).unassigned_citizen_count
    ),
    1,
    'super admin can cancel a queued project; returns unassigned_citizen_count=1'
  );

reset role;

-- ===========================================================================
-- Confirm status changed to cancelled
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.construction_projects
      where
        id = 'f7000000-0000-0000-0000-000000000001'
    ),
    'cancelled',
    'project status is cancelled after cancel_construction_project'
  );

-- ===========================================================================
-- Confirm cascade-unassign: citizen_assignments row removed
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        construction_project_id = 'f7000000-0000-0000-0000-000000000001'
    ),
    0,
    'citizen_assignments rows are removed after cancel (cascade-unassign)'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: cancel in_progress project
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.cancel_construction_project(
      'f7000000-0000-0000-0000-000000000002'
    )
    $test$,
    'settlement manager can cancel an in_progress project'
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
    select public.cancel_construction_project(
      'f7000000-0000-0000-0000-000000000002'
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
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cancel_construction_project(
      'f7000000-0000-0000-0000-000000000002'
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ALREADY CANCELLED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.cancel_construction_project(
      'f7000000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'already-cancelled project is rejected with P0001'
  );

-- ===========================================================================
-- ALREADY COMPLETE: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.cancel_construction_project(
      'f7000000-0000-0000-0000-000000000004'
    )
    $test$,
    'P0001',
    null,
    'already-complete project is rejected with P0001'
  );

-- ===========================================================================
-- NOT FOUND: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.cancel_construction_project(
      'f7000000-0000-0000-0000-000099999999'
    )
    $test$,
    'P0002',
    null,
    'non-existent project is rejected with P0002'
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
        proname = 'cancel_construction_project'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'cancel_construction_project is SECURITY DEFINER'
  );

-- ===========================================================================
-- Return value shape: project_id matches input
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Insert an extra queued project for this check
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
    'f7000000-0000-0000-0000-000000000005',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'queued',
    5,
    0
  );

select
  is (
    (
      select
        (
          public.cancel_construction_project ('f7000000-0000-0000-0000-000000000005')
        ).project_id
    ),
    'f7000000-0000-0000-0000-000000000005'::uuid,
    'returned project_id matches the input project id'
  );

reset role;

select
  *
from
  finish ();

rollback;
