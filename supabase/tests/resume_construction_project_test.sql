-- pgTAP tests for public.resume_construction_project RPC.
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all g-prefixed, unique to this file):
--   d1xxxxxx = users          d2xxxxxx = worlds
--   d3xxxxxx = nations        d4xxxxxx = settlements
--   d5xxxxxx = blueprints     d6xxxxxx = tiers
--   d7xxxxxx = projects       d8xxxxxx = citizens
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
    'd1000000-0000-0000-0000-000000000001',
    'resume-superadmin@example.com',
    'x',
    now(),
    '{"username":"resume_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'resume-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"resume_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'resume-outsider@example.com',
    'x',
    now(),
    '{"username":"resume_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd1000000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Resume World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Resume Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Resume Settlement'
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
    'd8000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'player_character',
    'Resume Settlement Manager PC',
    'alive',
    'd1000000-0000-0000-0000-000000000002',
    'settlement_manager',
    null,
    'd4000000-0000-0000-0000-000000000001'
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
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Resume Watchtower',
    'watchtower-resume',
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
    'd6000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    1,
    10
  );

-- Projects: cancelled (to be resumed), queued (non-cancelled), complete, in_progress
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
    'd7000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'cancelled',
    1,
    5,
    now()
  ),
  (
    'd7000000-0000-0000-0000-000000000002',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'queued',
    2,
    0,
    null
  ),
  (
    'd7000000-0000-0000-0000-000000000003',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'complete',
    3,
    10,
    null
  ),
  (
    'd7000000-0000-0000-0000-000000000004',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'in_progress',
    4,
    5,
    null
  );

-- ===========================================================================
-- SUPER ADMIN: resume cancelled project
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.resume_construction_project ('d7000000-0000-0000-0000-000000000001')
        ).project_id
    ),
    'd7000000-0000-0000-0000-000000000001'::uuid,
    'super admin can resume a cancelled project; returns project_id'
  );

reset role;

-- ===========================================================================
-- Confirm status changed to queued
-- ===========================================================================
select
  is (
    (
      select
        status
      from
        public.construction_projects
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    'queued',
    'project status is queued after resume_construction_project'
  );

-- ===========================================================================
-- Confirm cancelled_at was cleared
-- ===========================================================================
select
  is (
    (
      select
        cancelled_at
      from
        public.construction_projects
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    null,
    'cancelled_at is null after resume_construction_project'
  );

-- ===========================================================================
-- Confirm progress preserved
-- ===========================================================================
select
  is (
    (
      select
        progress_worker_turns::integer
      from
        public.construction_projects
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    5,
    'progress_worker_turns preserved after resume'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: resume cancelled project (should succeed)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- First, insert a cancelled project for the settlement manager to resume
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
    'd7000000-0000-0000-0000-000000000005',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'cancelled',
    5,
    3,
    now()
  );

select
  lives_ok (
    $test$
    select public.resume_construction_project(
      'd7000000-0000-0000-0000-000000000005'
    )
    $test$,
    'settlement manager can resume a cancelled project'
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
    select public.resume_construction_project(
      'd7000000-0000-0000-0000-000000000001'
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
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.resume_construction_project(
      'd7000000-0000-0000-0000-000000000001'
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
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.resume_construction_project(
      'd7000000-0000-0000-0000-000000000002'
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
    select public.resume_construction_project(
      'd7000000-0000-0000-0000-000099999999'
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
        proname = 'resume_construction_project'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'resume_construction_project is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
