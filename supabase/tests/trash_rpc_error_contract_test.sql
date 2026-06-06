-- pgTAP tests for the error contract of all trash RPCs.
-- Covers: P0002 (not found / null params), 42501 (unauthorized), and
-- P0001 (business constraint: must trash before hard-delete).
-- Run with: npx supabase test db
begin;

select
  plan (35);

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
    'ef000000-0000-0000-0000-000000000001',
    'ec-owner@example.com',
    'x',
    now(),
    '{"username":"ec_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ef000000-0000-0000-0000-000000000002',
    'ec-outsider@example.com',
    'x',
    now(),
    '{"username":"ec_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ef100000-0000-0000-0000-000000000001',
    'EC Test World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ef100000-0000-0000-0000-000000000001',
    'ef000000-0000-0000-0000-000000000001'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ef200000-0000-0000-0000-000000000001',
    'ef100000-0000-0000-0000-000000000001',
    'EC Ore',
    'ec-ore'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'ef300000-0000-0000-0000-000000000001',
    'ef100000-0000-0000-0000-000000000001',
    'EC Standard Job',
    'ec-standard-job',
    'standard',
    1
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ef300000-0000-0000-0000-000000000002',
    'ef100000-0000-0000-0000-000000000001',
    'EC Deposit Job',
    'ec-deposit-job',
    'deposit'
  ),
  (
    'ef300000-0000-0000-0000-000000000003',
    'ef100000-0000-0000-0000-000000000001',
    'EC Husbandry Job',
    'ec-husbandry-job',
    'husbandry'
  ),
  (
    'ef300000-0000-0000-0000-000000000004',
    'ef100000-0000-0000-0000-000000000001',
    'EC Culling Job',
    'ec-culling-job',
    'culling'
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'ef400000-0000-0000-0000-000000000001',
    'ef100000-0000-0000-0000-000000000001',
    'EC Forge',
    'ec-forge'
  );

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
    'ef500000-0000-0000-0000-000000000001',
    'ef100000-0000-0000-0000-000000000001',
    'EC Coal Seam',
    'ec-coal-seam',
    'ef300000-0000-0000-0000-000000000002',
    3
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
    growth_rate
  )
values
  (
    'ef600000-0000-0000-0000-000000000001',
    'ef100000-0000-0000-0000-000000000001',
    'EC Cattle',
    'ec-cattle',
    'ef300000-0000-0000-0000-000000000003',
    'ef300000-0000-0000-0000-000000000004',
    10,
    0.1
  );

-- ===========================================================================
-- P0002 (no_data_found) — world owner calls with a non-existent entity ID.
-- Auth check fires first (passes for world owner), then row-exists check
-- raises P0002.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ef000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.soft_delete_resource (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'soft_delete_resource raises P0002 for non-existent resource'
  );

select
  throws_ok (
    $test$
      select public.restore_resource (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'restore_resource raises P0002 for non-existent resource'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_resource (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'hard_delete_resource raises P0002 for non-existent resource'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_job_definition (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'soft_delete_job_definition raises P0002 for non-existent job'
  );

select
  throws_ok (
    $test$
      select public.restore_job_definition (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'restore_job_definition raises P0002 for non-existent job'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_job_definition (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'hard_delete_job_definition raises P0002 for non-existent job'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_building_blueprint (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'soft_delete_building_blueprint raises P0002 for non-existent blueprint'
  );

select
  throws_ok (
    $test$
      select public.restore_building_blueprint (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'restore_building_blueprint raises P0002 for non-existent blueprint'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_building_blueprint (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'hard_delete_building_blueprint raises P0002 for non-existent blueprint'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_deposit_type (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'soft_delete_deposit_type raises P0002 for non-existent deposit type'
  );

select
  throws_ok (
    $test$
      select public.restore_deposit_type (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'restore_deposit_type raises P0002 for non-existent deposit type'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_deposit_type (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'hard_delete_deposit_type raises P0002 for non-existent deposit type'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_managed_population_type (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'soft_delete_managed_population_type raises P0002 for non-existent managed population type'
  );

select
  throws_ok (
    $test$
      select public.restore_managed_population_type (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'restore_managed_population_type raises P0002 for non-existent managed population type'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_managed_population_type (
        '00000000-0000-0000-0000-000000000000',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'hard_delete_managed_population_type raises P0002 for non-existent managed population type'
  );

reset role;

-- ===========================================================================
-- 42501 (insufficient_privilege) — outsider calls with existing entity IDs.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ef000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.soft_delete_resource (
        'ef200000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'soft_delete_resource raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.restore_resource (
        'ef200000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'restore_resource raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_resource (
        'ef200000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'hard_delete_resource raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_job_definition (
        'ef300000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'soft_delete_job_definition raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.restore_job_definition (
        'ef300000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'restore_job_definition raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_job_definition (
        'ef300000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'hard_delete_job_definition raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_building_blueprint (
        'ef400000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'soft_delete_building_blueprint raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.restore_building_blueprint (
        'ef400000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'restore_building_blueprint raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_building_blueprint (
        'ef400000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'hard_delete_building_blueprint raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_deposit_type (
        'ef500000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'soft_delete_deposit_type raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.restore_deposit_type (
        'ef500000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'restore_deposit_type raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_deposit_type (
        'ef500000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'hard_delete_deposit_type raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.soft_delete_managed_population_type (
        'ef600000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'soft_delete_managed_population_type raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.restore_managed_population_type (
        'ef600000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'restore_managed_population_type raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_managed_population_type (
        'ef600000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'hard_delete_managed_population_type raises 42501 for unauthorized caller'
  );

reset role;

-- ===========================================================================
-- P0001 (raise_exception) — world owner calls hard_delete on an active
-- (non-trashed) entity. The "must trash first" constraint fires.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ef000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.hard_delete_resource (
        'ef200000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0001',
    null,
    'hard_delete_resource raises P0001 when resource is not trashed'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_job_definition (
        'ef300000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0001',
    null,
    'hard_delete_job_definition raises P0001 when job is not trashed'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_building_blueprint (
        'ef400000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0001',
    null,
    'hard_delete_building_blueprint raises P0001 when blueprint is not trashed'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_deposit_type (
        'ef500000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0001',
    null,
    'hard_delete_deposit_type raises P0001 when deposit type is not trashed'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_managed_population_type (
        'ef600000-0000-0000-0000-000000000001',
        'ef100000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0001',
    null,
    'hard_delete_managed_population_type raises P0001 when managed population type is not trashed'
  );

reset role;

select
  *
from
  finish ();

rollback;
