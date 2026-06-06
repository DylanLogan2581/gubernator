-- pgTAP tests: updated_at is still bumped by the set_updated_at trigger after
-- removing the redundant explicit assignments from the soft_delete_* / restore_*
-- RPCs.  Each assertion inserts a row with a past updated_at, calls the RPC,
-- then verifies updated_at equals the current transaction timestamp.
-- Run with: npx supabase test db
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
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
    'ee000000-0000-0000-0000-000000000001',
    'ua-owner@example.com',
    'x',
    now(),
    '{"username":"ua_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ee100000-0000-0000-0000-000000000001',
    'UA Test World',
    'private',
    'active'
  );

-- Resources: active (for soft_delete), pre-trashed (for restore).
insert into
  public.resources (id, world_id, name, slug, updated_at)
values
  (
    'ee200000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001',
    'UA Ore',
    'ua-ore',
    '2000-01-01 00:00:00+00'::timestamptz
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed, updated_at)
values
  (
    'ee200000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001',
    'UA Ore Trashed',
    'ua-ore-trashed',
    true,
    '2000-01-01 00:00:00+00'::timestamptz
  );

-- Helper jobs for deposit / managed-population fixtures.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ee300000-0000-0000-0000-000000000003',
    'ee100000-0000-0000-0000-000000000001',
    'UA Deposit Job',
    'ua-deposit-job',
    'deposit'
  ),
  (
    'ee300000-0000-0000-0000-000000000004',
    'ee100000-0000-0000-0000-000000000001',
    'UA Husbandry Job',
    'ua-husbandry-job',
    'husbandry'
  ),
  (
    'ee300000-0000-0000-0000-000000000005',
    'ee100000-0000-0000-0000-000000000001',
    'UA Culling Job',
    'ua-culling-job',
    'culling'
  );

-- Job definitions (standard): active (for soft_delete), pre-trashed (for restore).
insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    updated_at
  )
values
  (
    'ee300000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001',
    'UA Standard Job',
    'ua-standard-job',
    'standard',
    1,
    '2000-01-01 00:00:00+00'::timestamptz
  );

insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    is_trashed,
    updated_at
  )
values
  (
    'ee300000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001',
    'UA Standard Job Trashed',
    'ua-standard-job-trashed',
    'standard',
    1,
    true,
    '2000-01-01 00:00:00+00'::timestamptz
  );

-- Building blueprints: active (for soft_delete), pre-trashed (for restore).
insert into
  public.building_blueprints (id, world_id, name, slug, updated_at)
values
  (
    'ee400000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001',
    'UA Forge',
    'ua-forge',
    '2000-01-01 00:00:00+00'::timestamptz
  );

insert into
  public.building_blueprints (id, world_id, name, slug, is_trashed, updated_at)
values
  (
    'ee400000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001',
    'UA Forge Trashed',
    'ua-forge-trashed',
    true,
    '2000-01-01 00:00:00+00'::timestamptz
  );

-- Deposit types: active (for soft_delete), pre-trashed (for restore).
-- The two rows share a job_id — allowed because the partial unique index
-- only covers rows WHERE NOT is_trashed.
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker,
    updated_at
  )
values
  (
    'ee500000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001',
    'UA Coal',
    'ua-coal',
    'ee300000-0000-0000-0000-000000000003',
    1,
    '2000-01-01 00:00:00+00'::timestamptz
  );

insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker,
    is_trashed,
    updated_at
  )
values
  (
    'ee500000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001',
    'UA Coal Trashed',
    'ua-coal-trashed',
    'ee300000-0000-0000-0000-000000000003',
    1,
    true,
    '2000-01-01 00:00:00+00'::timestamptz
  );

-- Managed population types: active (for soft_delete), pre-trashed (for restore).
-- Shared husbandry/culling job_ids permitted for the same partial-index reason.
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    updated_at
  )
values
  (
    'ee600000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001',
    'UA Cattle',
    'ua-cattle',
    'ee300000-0000-0000-0000-000000000004',
    'ee300000-0000-0000-0000-000000000005',
    10,
    '2000-01-01 00:00:00+00'::timestamptz
  );

insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    is_trashed,
    updated_at
  )
values
  (
    'ee600000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001',
    'UA Cattle Trashed',
    'ua-cattle-trashed',
    'ee300000-0000-0000-0000-000000000004',
    'ee300000-0000-0000-0000-000000000005',
    10,
    true,
    '2000-01-01 00:00:00+00'::timestamptz
  );

-- ===========================================================================
-- All RPC calls run as the world owner.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ee000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------
select
  public.soft_delete_resource (
    'ee200000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.resources
      where
        id = 'ee200000-0000-0000-0000-000000000001'
    ),
    now(),
    'soft_delete_resource: updated_at is bumped by set_updated_at trigger'
  );

select
  public.restore_resource (
    'ee200000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.resources
      where
        id = 'ee200000-0000-0000-0000-000000000002'
    ),
    now(),
    'restore_resource: updated_at is bumped by set_updated_at trigger'
  );

-- ---------------------------------------------------------------------------
-- job_definitions
-- ---------------------------------------------------------------------------
select
  public.soft_delete_job_definition (
    'ee300000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.job_definitions
      where
        id = 'ee300000-0000-0000-0000-000000000001'
    ),
    now(),
    'soft_delete_job_definition: updated_at is bumped by set_updated_at trigger'
  );

select
  public.restore_job_definition (
    'ee300000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.job_definitions
      where
        id = 'ee300000-0000-0000-0000-000000000002'
    ),
    now(),
    'restore_job_definition: updated_at is bumped by set_updated_at trigger'
  );

-- ---------------------------------------------------------------------------
-- building_blueprints
-- ---------------------------------------------------------------------------
select
  public.soft_delete_building_blueprint (
    'ee400000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.building_blueprints
      where
        id = 'ee400000-0000-0000-0000-000000000001'
    ),
    now(),
    'soft_delete_building_blueprint: updated_at is bumped by set_updated_at trigger'
  );

select
  public.restore_building_blueprint (
    'ee400000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.building_blueprints
      where
        id = 'ee400000-0000-0000-0000-000000000002'
    ),
    now(),
    'restore_building_blueprint: updated_at is bumped by set_updated_at trigger'
  );

-- ---------------------------------------------------------------------------
-- deposit_types
-- ---------------------------------------------------------------------------
select
  public.soft_delete_deposit_type (
    'ee500000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.deposit_types
      where
        id = 'ee500000-0000-0000-0000-000000000001'
    ),
    now(),
    'soft_delete_deposit_type: updated_at is bumped by set_updated_at trigger'
  );

select
  public.restore_deposit_type (
    'ee500000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.deposit_types
      where
        id = 'ee500000-0000-0000-0000-000000000002'
    ),
    now(),
    'restore_deposit_type: updated_at is bumped by set_updated_at trigger'
  );

-- ---------------------------------------------------------------------------
-- managed_population_types
-- ---------------------------------------------------------------------------
select
  public.soft_delete_managed_population_type (
    'ee600000-0000-0000-0000-000000000001',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.managed_population_types
      where
        id = 'ee600000-0000-0000-0000-000000000001'
    ),
    now(),
    'soft_delete_managed_population_type: updated_at is bumped by set_updated_at trigger'
  );

select
  public.restore_managed_population_type (
    'ee600000-0000-0000-0000-000000000002',
    'ee100000-0000-0000-0000-000000000001'
  );

select
  is (
    (
      select
        updated_at
      from
        public.managed_population_types
      where
        id = 'ee600000-0000-0000-0000-000000000002'
    ),
    now(),
    'restore_managed_population_type: updated_at is bumped by set_updated_at trigger'
  );

reset role;

select
  *
from
  finish ();

rollback;
