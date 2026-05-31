-- pgTAP tests for the soft_delete_resource RPC.
-- Covers: system-resource rejection, unauthorised caller, and each of the
-- eight cleanup branches (job inputs/outputs, tier construction/upkeep/effects,
-- deposit worker inputs, population maintenance/culling outputs).
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
    'd1000000-0000-0000-0000-000000000001',
    'sdr-owner@example.com',
    'x',
    now(),
    '{"username":"sdr_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'sdr-outsider@example.com',
    'x',
    now(),
    '{"username":"sdr_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'SDR Test World',
    'd1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Resource that will be soft-deleted by the RPC.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Deletable Ore',
    'deletable-ore'
  );

-- A second resource that stays alive (should not be removed from any JSON).
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd3000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'Keeper Stone',
    'keeper-stone'
  );

-- Job that references the deletable resource in both inputs and outputs.
insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    inputs_json,
    outputs_json
  )
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Ore Refinery',
    'ore-refinery',
    'standard',
    5,
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount_per_worker":2},
      {"resource_id":"d3000000-0000-0000-0000-000000000002","amount_per_worker":1}]',
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount_per_worker":3}]'
  );

-- Blueprint and tier referencing the deletable resource in all three JSON
-- columns (construction costs, upkeep costs, and two effects entries).
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Ore Smelter',
    'ore-smelter'
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
    'd6000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    1,
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount":10},
      {"resource_id":"d3000000-0000-0000-0000-000000000002","amount":5}]',
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount":1}]',
    '[{"type":"passive_resource_production","resource_id":"d3000000-0000-0000-0000-000000000001","amount":4},
      {"type":"resource_storage_increase","resource_id":"d3000000-0000-0000-0000-000000000001","amount":100},
      {"type":"passive_resource_production","resource_id":"d3000000-0000-0000-0000-000000000002","amount":2}]'
  );

-- Deposit job (required for deposit_types FK).
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'd4000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'Mine Deposit',
    'mine-deposit',
    'deposit'
  );

-- Deposit type referencing the deletable resource in worker_inputs_json.
insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker,
    worker_inputs_json
  )
values
  (
    'd7000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Ore Deposit',
    'ore-deposit',
    'd4000000-0000-0000-0000-000000000002',
    5,
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount_per_worker":1},
      {"resource_id":"d3000000-0000-0000-0000-000000000002","amount_per_worker":2}]'
  );

-- Husbandry and culling jobs required for managed_population_types.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'd4000000-0000-0000-0000-000000000003',
    'd2000000-0000-0000-0000-000000000001',
    'Ore Beast Husbandry',
    'ore-beast-husbandry',
    'husbandry'
  ),
  (
    'd4000000-0000-0000-0000-000000000004',
    'd2000000-0000-0000-0000-000000000001',
    'Ore Beast Culling',
    'ore-beast-culling',
    'culling'
  );

-- Managed population type referencing the deletable resource in both JSON
-- columns.
insert into
  public.managed_population_types (
    id,
    world_id,
    name,
    slug,
    husbandry_job_id,
    culling_job_id,
    husbandry_workers_per_n_animals,
    maintenance_rules_json,
    culling_outputs_json
  )
values
  (
    'd8000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Ore Beast',
    'ore-beast',
    'd4000000-0000-0000-0000-000000000003',
    'd4000000-0000-0000-0000-000000000004',
    10,
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount_per_n_animals":5},
      {"resource_id":"d3000000-0000-0000-0000-000000000002","amount_per_n_animals":3}]',
    '[{"resource_id":"d3000000-0000-0000-0000-000000000001","amount_per_n_animals":2}]'
  );

-- ===========================================================================
-- SYSTEM-RESOURCE REJECTION
-- The 'Food' system resource is seeded automatically for the world above.
-- The RPC must raise restrict_violation (23001) and leave is_deleted = false.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.soft_delete_resource (
        (select id from public.resources
          where world_id = 'd2000000-0000-0000-0000-000000000001'
            and slug = 'food'),
        'd2000000-0000-0000-0000-000000000001'
      )
    $test$,
    '23001',
    null,
    'soft_delete_resource raises restrict_violation for a system resource'
  );

select
  ok (
    not (
      select
        is_deleted
      from
        public.resources
      where
        world_id = 'd2000000-0000-0000-0000-000000000001'
        and slug = 'food'
    ),
    'system resource remains not deleted after RPC call'
  );

reset role;

-- ===========================================================================
-- UNAUTHORISED CALLER
-- An outsider (no world access) must get insufficient_privilege (42501).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.soft_delete_resource (
        'd3000000-0000-0000-0000-000000000001',
        'd2000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'outsider cannot soft-delete a resource'
  );

reset role;

-- Verify by querying as superuser (outsider cannot see the private world's resources).
select
  ok (
    not (
      select
        is_deleted
      from
        public.resources
      where
        id = 'd3000000-0000-0000-0000-000000000001'
    ),
    'resource remains not deleted after outsider RPC call'
  );

-- ===========================================================================
-- HAPPY PATH: world owner performs the soft-delete
-- After this single RPC call all eight cleanup branches must fire.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        is_deleted
      from
        public.soft_delete_resource (
          'd3000000-0000-0000-0000-000000000001',
          'd2000000-0000-0000-0000-000000000001'
        )
    ),
    'soft_delete_resource returns the resource row with is_deleted = true'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Branch 1: job_definitions.inputs_json
-- Deletable Ore removed; Keeper Stone entry preserved.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        inputs_json
      from
        public.job_definitions
      where
        id = 'd4000000-0000-0000-0000-000000000001'
    ),
    '[{"resource_id":"d3000000-0000-0000-0000-000000000002","amount_per_worker":1}]'::jsonb,
    'deletable resource stripped from job inputs_json; keeper entry preserved'
  );

-- ---------------------------------------------------------------------------
-- Branch 2: job_definitions.outputs_json
-- Deletable Ore removed; outputs_json becomes empty array.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        outputs_json
      from
        public.job_definitions
      where
        id = 'd4000000-0000-0000-0000-000000000001'
    ),
    '[]'::jsonb,
    'deletable resource stripped from job outputs_json; empty array remains'
  );

-- ---------------------------------------------------------------------------
-- Branch 3: building_blueprint_tiers.construction_costs_json
-- Deletable Ore removed; Keeper Stone entry preserved.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        construction_costs_json
      from
        public.building_blueprint_tiers
      where
        id = 'd6000000-0000-0000-0000-000000000001'
    ),
    '[{"resource_id":"d3000000-0000-0000-0000-000000000002","amount":5}]'::jsonb,
    'deletable resource stripped from tier construction_costs_json; keeper entry preserved'
  );

-- ---------------------------------------------------------------------------
-- Branch 4: building_blueprint_tiers.upkeep_costs_json
-- Deletable Ore removed; upkeep_costs_json becomes empty array.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        upkeep_costs_json
      from
        public.building_blueprint_tiers
      where
        id = 'd6000000-0000-0000-0000-000000000001'
    ),
    '[]'::jsonb,
    'deletable resource stripped from tier upkeep_costs_json; empty array remains'
  );

-- ---------------------------------------------------------------------------
-- Branch 5: building_blueprint_tiers.effects_json
-- Both passive_resource_production and resource_storage_increase entries for
-- the deletable resource are removed; the keeper passive_resource_production
-- entry survives.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        effects_json
      from
        public.building_blueprint_tiers
      where
        id = 'd6000000-0000-0000-0000-000000000001'
    ),
    '[{"type":"passive_resource_production","resource_id":"d3000000-0000-0000-0000-000000000002","amount":2}]'::jsonb,
    'deletable resource stripped from tier effects_json; keeper effect entry preserved'
  );

-- ---------------------------------------------------------------------------
-- Branch 6: deposit_types.worker_inputs_json
-- Deletable Ore removed; Keeper Stone entry preserved.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        worker_inputs_json
      from
        public.deposit_types
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    '[{"resource_id":"d3000000-0000-0000-0000-000000000002","amount_per_worker":2}]'::jsonb,
    'deletable resource stripped from deposit worker_inputs_json; keeper entry preserved'
  );

-- ---------------------------------------------------------------------------
-- Branch 7: managed_population_types.maintenance_rules_json
-- Deletable Ore removed; Keeper Stone entry preserved.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        maintenance_rules_json
      from
        public.managed_population_types
      where
        id = 'd8000000-0000-0000-0000-000000000001'
    ),
    '[{"resource_id":"d3000000-0000-0000-0000-000000000002","amount_per_n_animals":3}]'::jsonb,
    'deletable resource stripped from population maintenance_rules_json; keeper entry preserved'
  );

-- ---------------------------------------------------------------------------
-- Branch 8: managed_population_types.culling_outputs_json
-- Deletable Ore removed; culling_outputs_json becomes empty array.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        culling_outputs_json
      from
        public.managed_population_types
      where
        id = 'd8000000-0000-0000-0000-000000000001'
    ),
    '[]'::jsonb,
    'deletable resource stripped from population culling_outputs_json; empty array remains'
  );

-- ---------------------------------------------------------------------------
-- Audit summary present on the resource row.
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        last_cleanup_summary_json is not null
        and (last_cleanup_summary_json ->> 'cleaned_at') is not null
      from
        public.resources
      where
        id = 'd3000000-0000-0000-0000-000000000001'
    ),
    'last_cleanup_summary_json is stamped on the soft-deleted resource'
  );

-- ---------------------------------------------------------------------------
-- Idempotency: calling the RPC on an already-deleted resource is a no-op.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.soft_delete_resource (
          'd3000000-0000-0000-0000-000000000001',
          'd2000000-0000-0000-0000-000000000001'
        )
    ),
    0,
    'soft_delete_resource returns no rows when resource is already deleted'
  );

reset role;

select
  *
from
  finish ();

rollback;
