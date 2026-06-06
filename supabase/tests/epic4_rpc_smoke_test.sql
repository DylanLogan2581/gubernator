-- pgTAP smoke test: every epic-4 RPC executes with valid params.
-- Calls soft_delete_* / restore_* / hard_delete_* for all five entity types
-- as the world owner and asserts no unexpected error is raised.
-- Catches ambiguous column identifiers (42702), missing GRANTs (42501), and
-- return-shape bugs before they reach production.
-- Run with: npx supabase test db
begin;

select
  plan (15);

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
    'ab000000-0000-0000-0000-000000000001',
    'smoke-owner@example.com',
    'x',
    now(),
    '{"username":"smoke_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Test World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ab100000-0000-0000-0000-000000000001',
    'ab000000-0000-0000-0000-000000000001'
  );

-- Resources: one active (soft_delete → restore), one pre-trashed (hard_delete).
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ab200000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Ore',
    'smoke-ore'
  );

insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'ab200000-0000-0000-0000-000000000002',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Ore Trashed',
    'smoke-ore-trashed',
    true
  );

-- Job definitions: two standard (one active, one pre-trashed) plus FK helpers.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'ab300000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Standard Job',
    'smoke-standard-job',
    'standard',
    1
  ),
  (
    'ab300000-0000-0000-0000-000000000002',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Standard Job Trashed',
    'smoke-standard-job-trashed',
    'standard',
    1
  );

update public.job_definitions
set
  is_trashed = true
where
  id = 'ab300000-0000-0000-0000-000000000002';

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ab300000-0000-0000-0000-000000000003',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Deposit Job',
    'smoke-deposit-job',
    'deposit'
  ),
  (
    'ab300000-0000-0000-0000-000000000004',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Husbandry Job',
    'smoke-husbandry-job',
    'husbandry'
  ),
  (
    'ab300000-0000-0000-0000-000000000005',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Culling Job',
    'smoke-culling-job',
    'culling'
  );

-- Building blueprints: one active, one pre-trashed.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'ab400000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Forge',
    'smoke-forge'
  );

insert into
  public.building_blueprints (id, world_id, name, slug, is_trashed)
values
  (
    'ab400000-0000-0000-0000-000000000002',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Forge Trashed',
    'smoke-forge-trashed',
    true
  );

-- Deposit types: one active, one pre-trashed.
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'ab500000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Coal',
    'smoke-coal',
    'ab300000-0000-0000-0000-000000000003',
    1
  );

insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker,
    is_trashed
  )
values
  (
    'ab500000-0000-0000-0000-000000000002',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Coal Trashed',
    'smoke-coal-trashed',
    'ab300000-0000-0000-0000-000000000003',
    1,
    true
  );

-- Managed population types: one active, one pre-trashed.
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals
  )
values
  (
    'ab600000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Cattle',
    'smoke-cattle',
    'ab300000-0000-0000-0000-000000000004',
    'ab300000-0000-0000-0000-000000000005',
    10
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
    is_trashed
  )
values
  (
    'ab600000-0000-0000-0000-000000000002',
    'ab100000-0000-0000-0000-000000000001',
    'Smoke Cattle Trashed',
    'smoke-cattle-trashed',
    'ab300000-0000-0000-0000-000000000004',
    'ab300000-0000-0000-0000-000000000005',
    10,
    true
  );

-- ===========================================================================
-- All RPC calls run as the world owner (authenticated, world admin via
-- ownership).  Each lives_ok assertion passes if the RPC returns without
-- raising an exception and fails on any SQLSTATE error.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
      select * from public.soft_delete_resource(
        'ab200000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'soft_delete_resource executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.restore_resource(
        'ab200000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'restore_resource executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.hard_delete_resource(
        'ab200000-0000-0000-0000-000000000002',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'hard_delete_resource executes without error'
  );

-- ---------------------------------------------------------------------------
-- job_definitions
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
      select * from public.soft_delete_job_definition(
        'ab300000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'soft_delete_job_definition executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.restore_job_definition(
        'ab300000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'restore_job_definition executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.hard_delete_job_definition(
        'ab300000-0000-0000-0000-000000000002',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'hard_delete_job_definition executes without error'
  );

-- ---------------------------------------------------------------------------
-- building_blueprints
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
      select * from public.soft_delete_building_blueprint(
        'ab400000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'soft_delete_building_blueprint executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.restore_building_blueprint(
        'ab400000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'restore_building_blueprint executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.hard_delete_building_blueprint(
        'ab400000-0000-0000-0000-000000000002',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'hard_delete_building_blueprint executes without error'
  );

-- ---------------------------------------------------------------------------
-- deposit_types
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
      select * from public.soft_delete_deposit_type(
        'ab500000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'soft_delete_deposit_type executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.restore_deposit_type(
        'ab500000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'restore_deposit_type executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.hard_delete_deposit_type(
        'ab500000-0000-0000-0000-000000000002',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'hard_delete_deposit_type executes without error'
  );

-- ---------------------------------------------------------------------------
-- managed_population_types
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
      select * from public.soft_delete_managed_population_type(
        'ab600000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'soft_delete_managed_population_type executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.restore_managed_population_type(
        'ab600000-0000-0000-0000-000000000001',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'restore_managed_population_type executes without error'
  );

select
  lives_ok (
    $test$
      select * from public.hard_delete_managed_population_type(
        'ab600000-0000-0000-0000-000000000002',
        'ab100000-0000-0000-0000-000000000001'
      )
    $test$,
    'hard_delete_managed_population_type executes without error'
  );

reset role;

select
  *
from
  finish ();

rollback;
