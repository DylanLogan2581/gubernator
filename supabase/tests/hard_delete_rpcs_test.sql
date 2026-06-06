-- pgTAP tests for the hard_delete_* RPCs (happy-path return shape).
-- Asserts that each function returns exactly one row with (id, world_id)
-- matching the deleted entity — covering the fix for the ambiguous column
-- reference bug (SQLSTATE 42702) in the RETURNING clause.
-- Run with: npx supabase test db
begin;

select
  plan (5);

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
    'ed000000-0000-0000-0000-000000000001',
    'hd-owner@example.com',
    'x',
    now(),
    '{"username":"hd_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ed100000-0000-0000-0000-000000000001',
    'HD Test World',
    'private',
    'active'
  );

-- Resource: soft-deleted so hard_delete is allowed.
insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'ed200000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001',
    'HD Ore',
    'hd-ore',
    true
  );

-- Jobs needed by deposit / managed-population fixtures.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ed300000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001',
    'HD Deposit Job',
    'hd-deposit-job',
    'deposit'
  ),
  (
    'ed300000-0000-0000-0000-000000000002',
    'ed100000-0000-0000-0000-000000000001',
    'HD Husbandry Job',
    'hd-husbandry-job',
    'husbandry'
  ),
  (
    'ed300000-0000-0000-0000-000000000003',
    'ed100000-0000-0000-0000-000000000001',
    'HD Culling Job',
    'hd-culling-job',
    'culling'
  );

-- Standard job that will itself be soft-deleted and then hard-deleted.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'ed300000-0000-0000-0000-000000000004',
    'ed100000-0000-0000-0000-000000000001',
    'HD Standard Job',
    'hd-standard-job',
    'standard',
    1
  );

-- Mark the standard job as trashed.
update public.job_definitions
set
  is_trashed = true
where
  id = 'ed300000-0000-0000-0000-000000000004';

-- Building blueprint: soft-deleted so hard_delete is allowed.
insert into
  public.building_blueprints (id, world_id, name, slug, is_trashed)
values
  (
    'ed400000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001',
    'HD Forge',
    'hd-forge',
    true
  );

-- Deposit type: soft-deleted so hard_delete is allowed.
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
    'ed500000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001',
    'HD Coal Seam',
    'hd-coal-seam',
    'ed300000-0000-0000-0000-000000000001',
    3,
    true
  );

-- Managed population type: soft-deleted so hard_delete is allowed.
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
    'ed600000-0000-0000-0000-000000000001',
    'ed100000-0000-0000-0000-000000000001',
    'HD Cattle',
    'hd-cattle',
    'ed300000-0000-0000-0000-000000000002',
    'ed300000-0000-0000-0000-000000000003',
    10,
    true
  );

-- ===========================================================================
-- All tests run as the world owner (authenticated, world admin via ownership).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ed000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- hard_delete_resource returns (id, world_id) for the deleted row
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (r.id, r.world_id)
      from
        public.hard_delete_resource (
          'ed200000-0000-0000-0000-000000000001',
          'ed100000-0000-0000-0000-000000000001'
        ) as r
    ),
    row (
      'ed200000-0000-0000-0000-000000000001'::uuid,
      'ed100000-0000-0000-0000-000000000001'::uuid
    ),
    'hard_delete_resource returns (id, world_id) of the deleted resource'
  );

-- ---------------------------------------------------------------------------
-- hard_delete_job_definition returns (id, world_id) for the deleted row
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (r.id, r.world_id)
      from
        public.hard_delete_job_definition (
          'ed300000-0000-0000-0000-000000000004',
          'ed100000-0000-0000-0000-000000000001'
        ) as r
    ),
    row (
      'ed300000-0000-0000-0000-000000000004'::uuid,
      'ed100000-0000-0000-0000-000000000001'::uuid
    ),
    'hard_delete_job_definition returns (id, world_id) of the deleted job'
  );

-- ---------------------------------------------------------------------------
-- hard_delete_building_blueprint returns (id, world_id) for the deleted row
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (r.id, r.world_id)
      from
        public.hard_delete_building_blueprint (
          'ed400000-0000-0000-0000-000000000001',
          'ed100000-0000-0000-0000-000000000001'
        ) as r
    ),
    row (
      'ed400000-0000-0000-0000-000000000001'::uuid,
      'ed100000-0000-0000-0000-000000000001'::uuid
    ),
    'hard_delete_building_blueprint returns (id, world_id) of the deleted blueprint'
  );

-- ---------------------------------------------------------------------------
-- hard_delete_deposit_type returns (id, world_id) for the deleted row
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (r.id, r.world_id)
      from
        public.hard_delete_deposit_type (
          'ed500000-0000-0000-0000-000000000001',
          'ed100000-0000-0000-0000-000000000001'
        ) as r
    ),
    row (
      'ed500000-0000-0000-0000-000000000001'::uuid,
      'ed100000-0000-0000-0000-000000000001'::uuid
    ),
    'hard_delete_deposit_type returns (id, world_id) of the deleted deposit type'
  );

-- ---------------------------------------------------------------------------
-- hard_delete_managed_population_type returns (id, world_id) for the deleted row
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (r.id, r.world_id)
      from
        public.hard_delete_managed_population_type (
          'ed600000-0000-0000-0000-000000000001',
          'ed100000-0000-0000-0000-000000000001'
        ) as r
    ),
    row (
      'ed600000-0000-0000-0000-000000000001'::uuid,
      'ed100000-0000-0000-0000-000000000001'::uuid
    ),
    'hard_delete_managed_population_type returns (id, world_id) of the deleted managed population type'
  );

reset role;

select
  *
from
  finish ();

rollback;
