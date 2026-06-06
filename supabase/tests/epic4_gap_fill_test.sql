-- pgTAP gap-fill tests for Epic 4 coverage completeness.
-- Covers: cross-world INSERT denied (all Epic 4 tables) and soft-delete
-- effect-type asymmetry (job_capacity_increase, population_cap_increase survive).
-- Run with: npx supabase test db
begin;

select
  plan (8);

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
    '91000000-0000-0000-0000-000000000001',
    'gf-alpha@example.com',
    'x',
    now(),
    '{"username":"gf_alpha"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'gf-beta@example.com',
    'x',
    now(),
    '{"username":"gf_beta"}'::jsonb,
    now(),
    now()
  );

-- World-alpha is owned by the alpha user; world-beta is owned by the beta user.
-- Alpha has no admin rights in world-beta, making it the cross-world target.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    '92000000-0000-0000-0000-000000000001',
    'GF Alpha World',
    'private',
    'active'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'GF Beta World',
    'private',
    'active'
  );

-- Jobs in world-beta needed as FK targets for cross-world INSERT tests and
-- for the tier effects_json fixture.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    '94000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000002',
    'Beta Deposit',
    'beta-deposit',
    'deposit'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    'Beta Husbandry',
    'beta-husbandry',
    'husbandry'
  ),
  (
    '94000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000002',
    'Beta Culling',
    'beta-culling',
    'culling'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    '94000000-0000-0000-0000-000000000004',
    '92000000-0000-0000-0000-000000000002',
    'Beta Standard',
    'beta-standard',
    'standard',
    5
  );

-- Blueprint in world-beta for the building_blueprint_tiers cross-world test
-- and as parent of the asymmetry tier below.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    '95000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000002',
    'Beta Forge',
    'beta-forge'
  );

-- Resource in world-beta that will be soft-deleted in the asymmetry test.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000002',
    'Beta Ore',
    'beta-ore'
  );

-- Tier whose effects_json contains only job_capacity_increase and
-- population_cap_increase — neither references a resource_id — so both
-- entries must survive the soft-delete cleanup unchanged.
insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    effects_json
  )
values
  (
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    1,
    '[{"type":"job_capacity_increase","job_id":"94000000-0000-0000-0000-000000000004","amount":5},
      {"type":"population_cap_increase","amount":10}]'
  );

-- ===========================================================================
-- CROSS-WORLD WRITE DENIED
-- The alpha user is owner/admin of world-alpha but has no access to world-beta.
-- Every Epic 4 table must reject an INSERT into world-beta with 42501.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.resources (world_id, name, slug)
    values (
      '92000000-0000-0000-0000-000000000002',
      'Alpha Into Beta',
      'alpha-into-beta-res'
    )
    $test$,
    '42501',
    null,
    'world admin cannot insert resources into another world'
  );

select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity)
    values (
      '92000000-0000-0000-0000-000000000002',
      'Alpha Into Beta Job',
      'alpha-into-beta-job',
      'standard',
      1
    )
    $test$,
    '42501',
    null,
    'world admin cannot insert job_definitions into another world'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprints (world_id, name, slug)
    values (
      '92000000-0000-0000-0000-000000000002',
      'Alpha Into Beta Blueprint',
      'alpha-into-beta-blueprint'
    )
    $test$,
    '42501',
    null,
    'world admin cannot insert building_blueprints into another world'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number)
    values (
      '95000000-0000-0000-0000-000000000001',
      99
    )
    $test$,
    '42501',
    null,
    'world admin cannot insert building_blueprint_tiers for a blueprint in another world'
  );

select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker)
    values (
      '92000000-0000-0000-0000-000000000002',
      'Alpha Into Beta Deposit',
      'alpha-into-beta-deposit',
      '94000000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'world admin cannot insert deposit_types into another world'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate
    )
    values (
      '92000000-0000-0000-0000-000000000002',
      'Alpha Into Beta Herd',
      'alpha-into-beta-herd',
      '94000000-0000-0000-0000-000000000002',
      '94000000-0000-0000-0000-000000000003',
      1,
      0
    )
    $test$,
    '42501',
    null,
    'world admin cannot insert managed_population_types into another world'
  );

reset role;

-- ===========================================================================
-- SOFT-DELETE EFFECT-TYPE ASYMMETRY
-- The soft_delete_resource RPC strips resource_id references from effects_json
-- (passive_resource_production, resource_storage_increase entries) but must
-- NOT touch job_capacity_increase or population_cap_increase entries.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Soft-delete beta-ore. Not a test assertion — setup for the two checks below.
select
  *
from
  public.soft_delete_resource (
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000002'
  );

reset role;

select
  ok (
    (
      select
        effects_json
      from
        public.building_blueprint_tiers
      where
        id = '96000000-0000-0000-0000-000000000001'
    ) @> '[{"type":"job_capacity_increase","job_id":"94000000-0000-0000-0000-000000000004","amount":5}]'::jsonb,
    'job_capacity_increase effect survives soft_delete_resource cleanup unchanged'
  );

select
  ok (
    (
      select
        effects_json
      from
        public.building_blueprint_tiers
      where
        id = '96000000-0000-0000-0000-000000000001'
    ) @> '[{"type":"population_cap_increase","amount":10}]'::jsonb,
    'population_cap_increase effect survives soft_delete_resource cleanup unchanged'
  );

select
  *
from
  finish ();

rollback;
