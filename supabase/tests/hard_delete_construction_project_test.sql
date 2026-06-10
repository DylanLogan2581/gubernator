-- pgTAP tests for public.hard_delete_construction_project RPC.
-- Run with: npx supabase test db
begin;

select
  plan (8);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all h-prefixed, unique to this file):
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
    'hard-delete-superadmin@example.com',
    'x',
    now(),
    '{"username":"hard_delete_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'hard-delete-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"hard_delete_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'hard-delete-outsider@example.com',
    'x',
    now(),
    '{"username":"hard_delete_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Hard Delete World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Hard Delete Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Hard Delete Settlement'
  );

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
    'Hard Delete Settlement Manager PC',
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
    'Hard Delete Watchtower',
    'watchtower-hard-delete',
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

-- Projects: cancelled (to be hard-deleted), queued (non-cancelled), complete
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position,
    progress_worker_turns,
    cancelled_at
  )
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'cancelled',
    1,
    5,
    now()
  ),
  (
    'e7000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'queued',
    2,
    0,
    null
  ),
  (
    'e7000000-0000-0000-0000-000000000003',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'complete',
    3,
    10,
    null
  );

-- ===========================================================================
-- SUPER ADMIN: hard-delete cancelled project
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
          public.hard_delete_construction_project ('e7000000-0000-0000-0000-000000000001')
        ).project_id
    ),
    'e7000000-0000-0000-0000-000000000001'::uuid,
    'super admin can hard-delete a cancelled project; returns project_id'
  );

reset role;

-- ===========================================================================
-- Confirm project deleted
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.construction_projects
      where
        id = 'e7000000-0000-0000-0000-000000000001'
    ),
    0,
    'project is deleted after hard_delete_construction_project'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: hard-delete cancelled project
-- ===========================================================================
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position,
    progress_worker_turns,
    cancelled_at
  )
values
  (
    'e7000000-0000-0000-0000-000000000004',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'cancelled',
    4,
    5,
    now()
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.hard_delete_construction_project(
      'e7000000-0000-0000-0000-000000000004'
    )
    $test$,
    'settlement manager can hard-delete a cancelled project'
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
    select public.hard_delete_construction_project(
      'e7000000-0000-0000-0000-000000000002'
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
    select public.hard_delete_construction_project(
      'e7000000-0000-0000-0000-000000000002'
    )
    $test$,
    '42501',
    null,
    'outsider is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- NOT CANCELLED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.hard_delete_construction_project(
      'e7000000-0000-0000-0000-000000000002'
    )
    $test$,
    'P0001',
    null,
    'non-cancelled (queued) project is rejected with P0001'
  );

-- ===========================================================================
-- NOT FOUND: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.hard_delete_construction_project(
      'e7000000-0000-0000-0000-000099999999'
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
        proname = 'hard_delete_construction_project'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'hard_delete_construction_project is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
