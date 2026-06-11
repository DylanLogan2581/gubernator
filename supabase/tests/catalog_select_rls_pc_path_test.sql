-- pgTAP tests for the player-character SELECT path on the Epic 4 catalog
-- tables: resources, job_definitions, deposit_types, managed_population_types,
-- building_blueprints, and building_blueprint_tiers.
--
-- Covers the SELECT policy swap introduced in
-- 20260607000002_extend_catalog_select_rls_pc_path.sql.
--
-- UUID prefix: d5 (unique to this file).
-- Run with: npx supabase test db
begin;

select
  plan (30);

-- ---------------------------------------------------------------------------
-- Fixtures (running as postgres / migration owner – bypasses RLS)
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
    'd5000000-0000-0000-0000-000000000001',
    'd5-owner@example.com',
    'x',
    now(),
    '{"username":"d5_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'd5000000-0000-0000-0000-000000000002',
    'd5-outsider@example.com',
    'x',
    now(),
    '{"username":"d5_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'd5000000-0000-0000-0000-000000000003',
    'd5-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"d5_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'd5000000-0000-0000-0000-000000000004',
    'd5-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"d5_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'd5000000-0000-0000-0000-000000000005',
    'd5-plain-pc@example.com',
    'x',
    now(),
    '{"username":"d5_plain_pc"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd5100000-0000-0000-0000-000000000001',
    'Catalog PC Test Private World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd5200000-0000-0000-0000-000000000001',
    'd5100000-0000-0000-0000-000000000001',
    'Catalog PC Test Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd5300000-0000-0000-0000-000000000001',
    'd5200000-0000-0000-0000-000000000001',
    'Catalog PC Test Settlement'
  );

-- Player-character citizens for the three PC users.
-- name is a generated column (given_name || coalesce(' ' || surname, '')).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
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
    'd5400000-0000-0000-0000-000000000003',
    'd5100000-0000-0000-0000-000000000001',
    'd5300000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Manager PC',
    'alive',
    'd5000000-0000-0000-0000-000000000003',
    'nation_manager',
    'd5200000-0000-0000-0000-000000000001',
    null
  ),
  (
    'd5400000-0000-0000-0000-000000000004',
    'd5100000-0000-0000-0000-000000000001',
    'd5300000-0000-0000-0000-000000000001',
    'player_character',
    'Settlement Manager PC',
    'alive',
    'd5000000-0000-0000-0000-000000000004',
    'settlement_manager',
    null,
    'd5300000-0000-0000-0000-000000000001'
  ),
  (
    'd5400000-0000-0000-0000-000000000005',
    'd5100000-0000-0000-0000-000000000001',
    'd5300000-0000-0000-0000-000000000001',
    'player_character',
    'Plain PC',
    'alive',
    'd5000000-0000-0000-0000-000000000005',
    'none',
    null,
    null
  );

-- Catalog rows in the private world.
-- resources: one non-system resource (Food + Fresh Water already seeded by trigger).
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd5500000-0000-0000-0000-000000000001',
    'd5100000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore'
  );

-- job_definitions: one standard job plus supporting deposit / husbandry / culling jobs.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'd5600000-0000-0000-0000-000000000001',
    'd5100000-0000-0000-0000-000000000001',
    'Farming',
    'farming',
    'standard',
    10
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'd5600000-0000-0000-0000-000000000002',
    'd5100000-0000-0000-0000-000000000001',
    'Mining',
    'mining',
    'deposit'
  ),
  (
    'd5600000-0000-0000-0000-000000000003',
    'd5100000-0000-0000-0000-000000000001',
    'Herding',
    'herding',
    'husbandry'
  ),
  (
    'd5600000-0000-0000-0000-000000000004',
    'd5100000-0000-0000-0000-000000000001',
    'Culling',
    'culling',
    'culling'
  );

-- deposit_types: one row linked to the deposit job.
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
    'd5700000-0000-0000-0000-000000000001',
    'd5100000-0000-0000-0000-000000000001',
    'Iron Deposit',
    'iron-deposit',
    'd5600000-0000-0000-0000-000000000002',
    5
  );

-- managed_population_types: one row linked to the husbandry and culling jobs.
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
    'd5800000-0000-0000-0000-000000000001',
    'd5100000-0000-0000-0000-000000000001',
    'Sheep',
    'sheep',
    'd5600000-0000-0000-0000-000000000003',
    'd5600000-0000-0000-0000-000000000004',
    5
  );

-- building_blueprints + one tier.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'd5900000-0000-0000-0000-000000000001',
    'd5100000-0000-0000-0000-000000000001',
    'Farmhouse',
    'farmhouse'
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
    'd5a00000-0000-0000-0000-000000000001',
    'd5900000-0000-0000-0000-000000000001',
    1,
    10
  );

-- ===========================================================================
-- OUTSIDER: user with no relationship to the world cannot read any catalog
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d5000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.resources
      where
        world_id = 'd5100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read resources in a private world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.job_definitions
      where
        world_id = 'd5100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read job_definitions in a private world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.deposit_types
      where
        world_id = 'd5100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read deposit_types in a private world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'd5100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read managed_population_types in a private world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.building_blueprints
      where
        world_id = 'd5100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read building_blueprints in a private world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.building_blueprint_tiers bbt
        join public.building_blueprints bb on bb.id = bbt.building_blueprint_id
      where
        bb.world_id = 'd5100000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read building_blueprint_tiers in a private world'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: active PC with nation_manager role can read all catalogs
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d5000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        id = 'd5500000-0000-0000-0000-000000000001'
    ),
    'nation manager can read resources in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        id = 'd5600000-0000-0000-0000-000000000001'
    ),
    'nation manager can read job_definitions in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.deposit_types
      where
        id = 'd5700000-0000-0000-0000-000000000001'
    ),
    'nation manager can read deposit_types in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        id = 'd5800000-0000-0000-0000-000000000001'
    ),
    'nation manager can read managed_population_types in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        id = 'd5900000-0000-0000-0000-000000000001'
    ),
    'nation manager can read building_blueprints in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprint_tiers
      where
        id = 'd5a00000-0000-0000-0000-000000000001'
    ),
    'nation manager can read building_blueprint_tiers in their private world'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: active PC with settlement_manager role can read all
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d5000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        id = 'd5500000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read resources in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        id = 'd5600000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read job_definitions in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.deposit_types
      where
        id = 'd5700000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read deposit_types in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        id = 'd5800000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read managed_population_types in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        id = 'd5900000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read building_blueprints in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprint_tiers
      where
        id = 'd5a00000-0000-0000-0000-000000000001'
    ),
    'settlement manager can read building_blueprint_tiers in their private world'
  );

reset role;

-- ===========================================================================
-- PLAIN PC: active PC with no role can read all catalogs
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d5000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        id = 'd5500000-0000-0000-0000-000000000001'
    ),
    'plain PC holder can read resources in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        id = 'd5600000-0000-0000-0000-000000000001'
    ),
    'plain PC holder can read job_definitions in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.deposit_types
      where
        id = 'd5700000-0000-0000-0000-000000000001'
    ),
    'plain PC holder can read deposit_types in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        id = 'd5800000-0000-0000-0000-000000000001'
    ),
    'plain PC holder can read managed_population_types in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        id = 'd5900000-0000-0000-0000-000000000001'
    ),
    'plain PC holder can read building_blueprints in their private world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprint_tiers
      where
        id = 'd5a00000-0000-0000-0000-000000000001'
    ),
    'plain PC holder can read building_blueprint_tiers in their private world'
  );

reset role;

-- ===========================================================================
-- WRITE RESTRICTIONS: PC holders (settlement manager used as representative)
-- cannot insert into any catalog table — write policies remain admin-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d5000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.resources (world_id, name, slug)
    values ('d5100000-0000-0000-0000-000000000001', 'PC Insert Resource', 'pc-insert-resource')
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert resources'
  );

select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity)
    values ('d5100000-0000-0000-0000-000000000001', 'PC Insert Job', 'pc-insert-job', 'standard', 1)
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert job_definitions'
  );

select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker)
    values (
      'd5100000-0000-0000-0000-000000000001',
      'PC Insert Deposit',
      'pc-insert-deposit',
      'd5600000-0000-0000-0000-000000000002',
      1
    )
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert deposit_types'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug,
      husbandry_job_id, culling_job_id, husbandry_workers_per_n_animals
    )
    values (
      'd5100000-0000-0000-0000-000000000001',
      'PC Insert Pop',
      'pc-insert-pop',
      'd5600000-0000-0000-0000-000000000003',
      'd5600000-0000-0000-0000-000000000004',
      5
    )
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert managed_population_types'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprints (world_id, name, slug)
    values ('d5100000-0000-0000-0000-000000000001', 'PC Insert Blueprint', 'pc-insert-blueprint')
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert building_blueprints'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (
      building_blueprint_id, tier_number, worker_turns_required
    )
    values ('d5900000-0000-0000-0000-000000000001', 2, 20)
  $test$,
    '42501',
    null,
    'settlement manager (PC) cannot insert building_blueprint_tiers'
  );

reset role;

select
  *
from
  finish ();

rollback;
