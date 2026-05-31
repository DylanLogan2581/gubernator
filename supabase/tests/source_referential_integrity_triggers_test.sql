-- pgTAP tests for the source-table referential integrity triggers added in
-- 20260530000016_enforce_referential_integrity_source_triggers.sql.
--
-- The migration adds BEFORE triggers on public.resources and
-- public.job_definitions that reject DELETE or invalidating UPDATE (flipping
-- is_deleted/is_active true→false direction-as-appropriate, or changing
-- world_id) while any dependent JSON configuration still references the row.
-- Run with: npx supabase test db
begin;

select
  plan (11);

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
    'f1000000-0000-0000-0000-000000000001',
    'srit-owner@example.com',
    'x',
    now(),
    '{"username":"srit_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'SRIT Test World',
    'f1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Resources: one referenced by configs, one unreferenced.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Referenced Ore',
    'ref-ore'
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Free Stone',
    'free-stone'
  );

-- Job referenced by a building blueprint tier effect AND referencing the ore.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Referenced Job',
    'ref-job',
    'standard',
    1
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Free Job',
    'free-job',
    'standard',
    1
  );

update public.job_definitions
set
  inputs_json = jsonb_build_array(
    jsonb_build_object(
      'resource_id',
      'f3000000-0000-0000-0000-000000000001'::text,
      'amount_per_worker',
      1
    )
  )
where
  id = 'f4000000-0000-0000-0000-000000000001';

-- Building blueprint and tier referencing both resource and job.
insert into
  public.building_blueprints (id, world_id, name, slug, is_active)
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Forge',
    'forge',
    true
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    construction_costs_json,
    upkeep_costs_json,
    effects_json
  )
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    1,
    jsonb_build_array(
      jsonb_build_object(
        'resource_id',
        'f3000000-0000-0000-0000-000000000001'::text,
        'amount',
        5
      )
    ),
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type',
        'job_capacity_increase',
        'job_id',
        'f4000000-0000-0000-0000-000000000001'::text,
        'amount',
        1
      )
    )
  );

-- ===========================================================================
-- All mutations run as the world owner.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Direct DELETE on a referenced resource is rejected.
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    delete from public.resources
    where id = 'f3000000-0000-0000-0000-000000000001'
    $test$,
    '23001',
    null,
    'direct delete on a referenced resource is rejected'
  );

-- Flipping is_deleted on a referenced resource is rejected.
select
  throws_ok (
    $test$
    update public.resources
    set is_deleted = true
    where id = 'f3000000-0000-0000-0000-000000000001'
    $test$,
    '23001',
    null,
    'flipping is_deleted=true on a referenced resource is rejected'
  );

-- Renames on a referenced resource are still allowed.
select
  lives_ok (
    $test$
    update public.resources
    set name = 'Renamed Ore'
    where id = 'f3000000-0000-0000-0000-000000000001'
    $test$,
    'rename of a referenced resource is allowed'
  );

-- Direct DELETE on an unreferenced resource is allowed.
select
  lives_ok (
    $test$
    delete from public.resources
    where id = 'f3000000-0000-0000-0000-000000000002'
    $test$,
    'direct delete on an unreferenced resource is allowed'
  );

-- ---------------------------------------------------------------------------
-- Direct DELETE on a referenced job_definition is rejected.
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    delete from public.job_definitions
    where id = 'f4000000-0000-0000-0000-000000000001'
    $test$,
    '23001',
    null,
    'direct delete on a job referenced by a tier effect is rejected'
  );

-- Direct UPDATE flipping is_active=false on a referenced job is rejected.
select
  throws_ok (
    $test$
    update public.job_definitions
    set is_active = false
    where id = 'f4000000-0000-0000-0000-000000000001'
    $test$,
    '23001',
    null,
    'flipping is_active=false on a referenced job is rejected'
  );

-- Renames on a referenced job are still allowed.
select
  lives_ok (
    $test$
    update public.job_definitions
    set name = 'Renamed Job'
    where id = 'f4000000-0000-0000-0000-000000000001'
    $test$,
    'rename of a referenced job is allowed'
  );

-- Direct DELETE on an unreferenced job is allowed.
select
  lives_ok (
    $test$
    delete from public.job_definitions
    where id = 'f4000000-0000-0000-0000-000000000002'
    $test$,
    'direct delete on an unreferenced job is allowed'
  );

-- ---------------------------------------------------------------------------
-- soft_delete_resource cleans up refs first, so the trigger lets the flip
-- through.
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        count(*)::int = 1
      from
        public.soft_delete_resource (
          'f3000000-0000-0000-0000-000000000001',
          'f2000000-0000-0000-0000-000000000001'
        )
    ),
    'soft_delete_resource succeeds for a referenced resource (strip-then-flip)'
  );

-- After the soft delete, the dependent tier no longer references the resource.
select
  is (
    (
      select
        count(*)::int
      from
        public.building_blueprint_tiers bbt
      where
        bbt.id = 'f6000000-0000-0000-0000-000000000001'
        and bbt.construction_costs_json @> jsonb_build_array(
          jsonb_build_object(
            'resource_id',
            'f3000000-0000-0000-0000-000000000001'::text
          )
        )
    ),
    0,
    'soft_delete_resource stripped the resource from construction_costs_json'
  );

-- ---------------------------------------------------------------------------
-- soft_delete_job_definition now also strips referencing tier effects before
-- flipping is_active. Re-create a referenced job and tier effect, then verify.
-- ---------------------------------------------------------------------------
reset role;

insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'f4000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'Second Referenced Job',
    'ref-job-2',
    'standard',
    1
  );

update public.building_blueprint_tiers
set
  effects_json = jsonb_build_array(
    jsonb_build_object(
      'type',
      'job_capacity_increase',
      'job_id',
      'f4000000-0000-0000-0000-000000000003'::text,
      'amount',
      2
    )
  )
where
  id = 'f6000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- soft_delete_job_definition succeeds after stripping the tier effect ref.
select
  ok (
    (
      select
        count(*)::int = 1
      from
        public.soft_delete_job_definition (
          'f4000000-0000-0000-0000-000000000003',
          'f2000000-0000-0000-0000-000000000001'
        )
    ),
    'soft_delete_job_definition succeeds for a referenced job (strip-then-flip)'
  );

reset role;

select
  *
from
  finish ();

rollback;
