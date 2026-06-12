-- pgTAP tests for construction_costs_json, upkeep_costs_json, and effects_json
-- validation on building_blueprint_tiers.
-- Covers: malformed shape, unknown resource_id, unknown job_id,
-- cross-world references, soft-deleted resources, inactive jobs, and all four
-- effect-type happy paths.
-- Run with: npx supabase test db
begin;

select
  plan (27);

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
    'c1000000-0000-0000-0000-000000000001',
    'btv-owner@example.com',
    'x',
    now(),
    '{"username":"btv_owner"}'::jsonb,
    now(),
    now()
  );

-- World 1: where blueprints and tiers live.
-- World 2: provides cross-world resources and jobs for rejection tests.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'BTV Main World',
    'c1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'BTV Other World',
    'c1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Iron: valid, non-deleted resource in world 1
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Iron',
    'iron'
  );

-- Wool: resource in world 2 (cross-world rejection tests)
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'Wool',
    'wool'
  );

-- Old Stone: soft-deleted resource in world 1
insert into
  public.resources (id, world_id, name, slug, is_deleted)
values
  (
    'c3000000-0000-0000-0000-000000000003',
    'c2000000-0000-0000-0000-000000000001',
    'Old Stone',
    'old-stone',
    true
  );

-- Smelting: active job in world 1
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Smelting',
    'smelting',
    'standard',
    10
  );

-- Retired Farming: inactive job in world 1
insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    is_active
  )
values
  (
    'c4000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'Retired Farming',
    'retired-farming',
    'standard',
    5,
    false
  );

-- Foreign Trade: active job in world 2 (cross-world rejection tests)
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'c4000000-0000-0000-0000-000000000003',
    'c2000000-0000-0000-0000-000000000002',
    'Foreign Trade',
    'foreign-trade',
    'standard',
    8
  );

-- Forge blueprint in world 1 — tiers are inserted against this
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'c5000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Forge',
    'forge'
  );

-- ===========================================================================
-- CONSTRUCTION_COSTS_JSON — shape validation
-- All tests run as the postgres superuser (no role set) so RLS is bypassed
-- and only the trigger is exercised.
-- ===========================================================================
-- Not an array
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '"not an array"'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json that is not an array is rejected'
  );

-- Element missing resource_id
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"amount": 5}]'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json element missing resource_id is rejected'
  );

-- Element missing amount
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000001"}]'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json element missing amount is rejected'
  );

-- Extra key present
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000001", "amount": 1, "extra": true}]'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json element with extra key is rejected'
  );

-- ===========================================================================
-- CONSTRUCTION_COSTS_JSON — referential validation
-- ===========================================================================
-- resource_id does not exist in any world
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"resource_id": "00000000-0000-0000-0000-000000000000", "amount": 1}]'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json with unknown resource_id is rejected'
  );

-- resource_id belongs to a different world
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000002", "amount": 1}]'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json with cross-world resource_id is rejected'
  );

-- resource_id is soft-deleted
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000003", "amount": 1}]'
    )
    $test$,
    'P0001',
    null,
    'construction_costs_json referencing soft-deleted resource is rejected'
  );

-- ===========================================================================
-- UPKEEP_COSTS_JSON — also validated by the same helper
-- ===========================================================================
-- Not an array
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, upkeep_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '"not an array"'
    )
    $test$,
    'P0001',
    null,
    'upkeep_costs_json that is not an array is rejected'
  );

-- cross-world resource_id
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, upkeep_costs_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000002", "amount": 2}]'
    )
    $test$,
    'P0001',
    null,
    'upkeep_costs_json with cross-world resource_id is rejected'
  );

-- ===========================================================================
-- EFFECTS_JSON — shape validation
-- ===========================================================================
-- Not an array
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '"not an array"'
    )
    $test$,
    'P0001',
    null,
    'effects_json that is not an array is rejected'
  );

-- Unknown type
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "magic_boost", "amount": 5}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json with unknown type is rejected'
  );

-- Missing amount
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "population_cap_increase"}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json element missing amount is rejected'
  );

-- job_capacity_increase missing job_id
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "job_capacity_increase", "amount": 3}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json job_capacity_increase missing job_id is rejected'
  );

-- Extra key on population_cap_increase
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "population_cap_increase", "amount": 10, "extra": true}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json population_cap_increase with extra key is rejected'
  );

-- ===========================================================================
-- EFFECTS_JSON — referential validation
-- ===========================================================================
-- Unknown resource_id (passive_resource_production)
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "passive_resource_production", "resource_id": "00000000-0000-0000-0000-000000000000", "amount": 1}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json passive_resource_production with unknown resource_id is rejected'
  );

-- Unknown job_id (job_capacity_increase)
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "job_capacity_increase", "job_id": "00000000-0000-0000-0000-000000000000", "amount": 2}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json job_capacity_increase with unknown job_id is rejected'
  );

-- Cross-world resource_id (resource_storage_increase)
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "resource_storage_increase", "resource_id": "c3000000-0000-0000-0000-000000000002", "amount": 50}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json resource_storage_increase with cross-world resource_id is rejected'
  );

-- Cross-world job_id (job_capacity_increase)
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "job_capacity_increase", "job_id": "c4000000-0000-0000-0000-000000000003", "amount": 2}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json job_capacity_increase with cross-world job_id is rejected'
  );

-- Soft-deleted resource (passive_resource_production)
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "passive_resource_production", "resource_id": "c3000000-0000-0000-0000-000000000003", "amount": 1}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json passive_resource_production referencing soft-deleted resource is rejected'
  );

-- Inactive job (job_capacity_increase)
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'c5000000-0000-0000-0000-000000000001', 1,
      '[{"type": "job_capacity_increase", "job_id": "c4000000-0000-0000-0000-000000000002", "amount": 1}]'
    )
    $test$,
    'P0001',
    null,
    'effects_json job_capacity_increase referencing inactive job is rejected'
  );

-- ===========================================================================
-- HAPPY PATH
-- ===========================================================================
-- Default empty arrays are accepted
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number)
    values (
      'c6000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      100
    )
    $test$,
    'default empty arrays are accepted'
  );

-- Valid construction_costs_json with one entry
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, construction_costs_json)
    values (
      'c6000000-0000-0000-0000-000000000002',
      'c5000000-0000-0000-0000-000000000001',
      101,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000001", "amount": 10}]'
    )
    $test$,
    'valid construction_costs_json is accepted'
  );

-- Valid upkeep_costs_json with one entry
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, upkeep_costs_json)
    values (
      'c6000000-0000-0000-0000-000000000003',
      'c5000000-0000-0000-0000-000000000001',
      102,
      '[{"resource_id": "c3000000-0000-0000-0000-000000000001", "amount": 2}]'
    )
    $test$,
    'valid upkeep_costs_json is accepted'
  );

-- effects_json: job_capacity_increase happy path
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, effects_json)
    values (
      'c6000000-0000-0000-0000-000000000004',
      'c5000000-0000-0000-0000-000000000001',
      103,
      '[{"type": "job_capacity_increase", "job_id": "c4000000-0000-0000-0000-000000000001", "amount": 5}]'
    )
    $test$,
    'effects_json job_capacity_increase is accepted'
  );

-- effects_json: passive_resource_production happy path
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, effects_json)
    values (
      'c6000000-0000-0000-0000-000000000005',
      'c5000000-0000-0000-0000-000000000001',
      104,
      '[{"type": "passive_resource_production", "resource_id": "c3000000-0000-0000-0000-000000000001", "amount": 3}]'
    )
    $test$,
    'effects_json passive_resource_production is accepted'
  );

-- effects_json: resource_storage_increase happy path
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, effects_json)
    values (
      'c6000000-0000-0000-0000-000000000006',
      'c5000000-0000-0000-0000-000000000001',
      105,
      '[{"type": "resource_storage_increase", "resource_id": "c3000000-0000-0000-0000-000000000001", "amount": 100}]'
    )
    $test$,
    'effects_json resource_storage_increase is accepted'
  );

-- effects_json: population_cap_increase happy path
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, effects_json)
    values (
      'c6000000-0000-0000-0000-000000000007',
      'c5000000-0000-0000-0000-000000000001',
      106,
      '[{"type": "population_cap_increase", "amount": 50}]'
    )
    $test$,
    'effects_json population_cap_increase is accepted'
  );

select
  *
from
  finish ();

rollback;
