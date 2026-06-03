-- pgTAP tests for public.settlement_job_capacity helper function.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   e1xxxxxx = users          e2xxxxxx = worlds
--   e3xxxxxx = nations        e4xxxxxx = settlements
--   e5xxxxxx = blueprints     e6xxxxxx = tiers
--   e7xxxxxx = buildings      e8xxxxxx = job definitions
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
    'jobcap-owner@example.com',
    'x',
    now(),
    '{"username":"jobcap_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'JobCap World',
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
    'JobCap Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'JobCap Settlement'
  );

-- Job 1: standard job with base_capacity = 5.
-- Job 2: deposit job with no base_capacity (null).
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'JobCap Farming',
    'jobcap-farming',
    'standard',
    5
  ),
  (
    'e8000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'JobCap Mining',
    'jobcap-mining',
    'husbandry',
    null
  );

-- Blueprint 1: tier grants +3 capacity for job 1.
-- Blueprint 2: tier grants +10 capacity for job 2.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'JobCap Barracks',
    'jobcap-barracks'
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'JobCap Mine',
    'jobcap-mine'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required,
    effects_json
  )
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    1,
    10,
    '[{"type":"job_capacity_increase","job_id":"e8000000-0000-0000-0000-000000000001","amount":3}]'::jsonb
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e5000000-0000-0000-0000-000000000002',
    1,
    10,
    '[{"type":"job_capacity_increase","job_id":"e8000000-0000-0000-0000-000000000002","amount":10}]'::jsonb
  );

-- ===========================================================================
-- TEST 1: base_capacity is returned when no buildings exist
-- ===========================================================================
select
  is (
    public.settlement_job_capacity (
      'e4000000-0000-0000-0000-000000000001',
      'e8000000-0000-0000-0000-000000000001'
    ),
    5,
    'settlement_job_capacity returns base_capacity when no buildings exist'
  );

-- ===========================================================================
-- TEST 2: null base_capacity is treated as 0
-- ===========================================================================
select
  is (
    public.settlement_job_capacity (
      'e4000000-0000-0000-0000-000000000001',
      'e8000000-0000-0000-0000-000000000002'
    ),
    0,
    'settlement_job_capacity treats null base_capacity as 0'
  );

-- Insert one active Barracks building (+3 for job 1).
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    activated_on_turn_number
  )
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    'active',
    1
  );

-- ===========================================================================
-- TEST 3: active building with job_capacity_increase effect adds to base_capacity
-- ===========================================================================
select
  is (
    public.settlement_job_capacity (
      'e4000000-0000-0000-0000-000000000001',
      'e8000000-0000-0000-0000-000000000001'
    ),
    8,
    'settlement_job_capacity adds active building effects to base_capacity (5 + 3 = 8)'
  );

-- Insert one active Mine building (+10 for job 2); must not affect job 1 capacity.
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    activated_on_turn_number
  )
values
  (
    'e7000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000002',
    'e6000000-0000-0000-0000-000000000002',
    'active',
    1
  );

-- ===========================================================================
-- TEST 4: effects for a different job are excluded
-- ===========================================================================
select
  is (
    public.settlement_job_capacity (
      'e4000000-0000-0000-0000-000000000001',
      'e8000000-0000-0000-0000-000000000001'
    ),
    8,
    'settlement_job_capacity ignores effects targeting a different job_id'
  );

-- Suspend the Barracks building so only base_capacity remains for job 1.
update public.settlement_buildings
set
  state = 'suspended'
where
  id = 'e7000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- TEST 5: suspended and deconstructed buildings are excluded
-- ===========================================================================
select
  is (
    public.settlement_job_capacity (
      'e4000000-0000-0000-0000-000000000001',
      'e8000000-0000-0000-0000-000000000001'
    ),
    5,
    'settlement_job_capacity excludes suspended buildings (only base_capacity = 5 remains)'
  );

select
  *
from
  finish ();

rollback;
