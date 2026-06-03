-- pgTAP gap-fill coverage for Epic 5 tables and RLS matrix.
-- Run with: npx supabase test db
--
-- Coverage matrix
-- (✓ = covered by per-card suite; NEW = first covered here; — = not applicable)
--
-- TABLE                          | anon | outsider | PC  | NM/SM | WorldAdmin | CrossWorld | Notes
-- ------------------------------ | ---- | -------- | --- | ----- | ---------- | ---------- | -----
-- settlement_resource_stockpiles | NEW  | NEW      | NEW | NEW   | ✓          | ✓          | stockpiles seeded by trigger
-- construction_projects          | NEW  | NEW      | NEW | NEW   | ✓          | ✓          |
-- settlement_buildings           | NEW  | NEW      | NEW | NEW   | ✓          | ✓          |
-- deposit_instances              | NEW  | NEW      | NEW | NEW   | ✓          | ✓          |
-- deposit_instance_resources     | NEW  | NEW      | NEW | NEW   | ✓          | ✓          |
-- managed_population_instances   | NEW  | NEW      | NEW | NEW   | ✓          | ✓          |
-- trade_routes (bilateral)       | ✓    | ✓        | ✓   | ✓     | ✓          | ✓          | gaps: one-side hidden, both-hidden+admin
--
-- Additional gap areas tested here:
--   • Trade routes bilateral: origin-hidden/dest-visible (third-party world-access user can read);
--     both-hidden pair invisible to PC but visible to world admin.
--   • Assignment RPCs: SM of wrong settlement → 42501 for all four target types and bulk ops.
--   • Bulk assignment npc_first strategy: NPC removed before PC when lowering count by 1.
--
-- UUID prefix: a5 (unique to this file; all others start with a different two-hex prefix).
begin;

select
  plan (47);

-- ---------------------------------------------------------------------------
-- Fixtures (running as postgres / migration owner – bypasses RLS)
-- ---------------------------------------------------------------------------
-- Auth users
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
    'a5000000-0000-0000-0000-000000000001',
    'a5-world-admin@example.com',
    'x',
    now(),
    '{"username":"a5_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000002',
    'a5-outsider@example.com',
    'x',
    now(),
    '{"username":"a5_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000003',
    'a5-pc-user@example.com',
    'x',
    now(),
    '{"username":"a5_pc_user"}'::jsonb,
    now(),
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000004',
    'a5-sm1@example.com',
    'x',
    now(),
    '{"username":"a5_sm1"}'::jsonb,
    now(),
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000005',
    'a5-sm2@example.com',
    'x',
    now(),
    '{"username":"a5_sm2"}'::jsonb,
    now(),
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000006',
    'a5-nm1@example.com',
    'x',
    now(),
    '{"username":"a5_nm1"}'::jsonb,
    now(),
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000007',
    'a5-nm2@example.com',
    'x',
    now(),
    '{"username":"a5_nm2"}'::jsonb,
    now(),
    now()
  );

-- Worlds
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'a5100000-0000-0000-0000-000000000001',
    'A5 World Alpha',
    'a5000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'a5100000-0000-0000-0000-000000000002',
    'A5 World Beta',
    'a5000000-0000-0000-0000-000000000002',
    'private',
    'active'
  );

-- Nations: nation_1 and nation_2 are visible; nation_hmix and nation_hduo are
-- hidden (used for trade-route bilateral visibility gap tests).
insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'a5200000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Nation One',
    false
  ),
  (
    'a5200000-0000-0000-0000-000000000002',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Nation Two',
    false
  ),
  (
    'a5200000-0000-0000-0000-000000000003',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Nation HMix',
    true
  ),
  (
    'a5200000-0000-0000-0000-000000000004',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Nation HDuo',
    true
  ),
  (
    'a5200000-0000-0000-0000-000000000005',
    'a5100000-0000-0000-0000-000000000002',
    'A5 Nation Beta',
    false
  );

-- Settlements
insert into
  public.settlements (id, nation_id, name)
values
  (
    'a5300000-0000-0000-0000-000000000001',
    'a5200000-0000-0000-0000-000000000001',
    'A5 Settlement One'
  ),
  (
    'a5300000-0000-0000-0000-000000000002',
    'a5200000-0000-0000-0000-000000000002',
    'A5 Settlement Two'
  ),
  (
    'a5300000-0000-0000-0000-000000000003',
    'a5200000-0000-0000-0000-000000000003',
    'A5 Settlement HMix'
  ),
  (
    'a5300000-0000-0000-0000-000000000004',
    'a5200000-0000-0000-0000-000000000004',
    'A5 Settlement HDuo'
  ),
  (
    'a5300000-0000-0000-0000-000000000005',
    'a5200000-0000-0000-0000-000000000005',
    'A5 Settlement Beta'
  );

-- Resource: inserting AFTER settlements so the resources_seed_stockpiles trigger
-- fires and seeds one stockpile row per existing world-alpha settlement.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'a5400000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Iron',
    'a5-iron'
  );

-- Job definitions: standard requires base_capacity; deposit/husbandry/culling require null.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'a5600000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Standard Job',
    'a5-standard-job',
    'standard',
    10
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'a5600000-0000-0000-0000-000000000002',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Deposit Job',
    'a5-deposit-job',
    'deposit'
  ),
  (
    'a5600000-0000-0000-0000-000000000003',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Husbandry Job',
    'a5-husbandry-job',
    'husbandry'
  ),
  (
    'a5600000-0000-0000-0000-000000000004',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Culling Job',
    'a5-culling-job',
    'culling'
  );

-- Deposit type (world-level; referenced by deposit_instances)
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
    'a5610000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Iron Vein',
    'a5-iron-vein',
    'a5600000-0000-0000-0000-000000000002',
    1
  );

-- Managed population type
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
    'a5620000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Cattle',
    'a5-cattle',
    'a5600000-0000-0000-0000-000000000003',
    'a5600000-0000-0000-0000-000000000004',
    5,
    0.1
  );

-- Building blueprint + tier
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'a5700000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'A5 Forge',
    'a5-forge'
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
    'a5800000-0000-0000-0000-000000000001',
    'a5700000-0000-0000-0000-000000000001',
    1,
    0
  );

-- Citizens: 5 player_characters + 2 NPCs
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    user_id,
    name,
    status,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  -- Plain PC for pc_user (settlement_1, no manager role)
  (
    'a5500000-0000-0000-0000-000000000001',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'player_character',
    'a5000000-0000-0000-0000-000000000003',
    'A5 PC Citizen',
    'alive',
    'none',
    null,
    null
  ),
  -- SM of settlement_1 (sm1_user)
  (
    'a5500000-0000-0000-0000-000000000002',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'player_character',
    'a5000000-0000-0000-0000-000000000004',
    'A5 SM1 Citizen',
    'alive',
    'settlement_manager',
    null,
    'a5300000-0000-0000-0000-000000000001'
  ),
  -- SM of settlement_2 (sm2_user – the "wrong-side" manager)
  (
    'a5500000-0000-0000-0000-000000000003',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000002',
    'player_character',
    'a5000000-0000-0000-0000-000000000005',
    'A5 SM2 Citizen',
    'alive',
    'settlement_manager',
    null,
    'a5300000-0000-0000-0000-000000000002'
  ),
  -- NM of nation_1 (nm1_user)
  (
    'a5500000-0000-0000-0000-000000000004',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'player_character',
    'a5000000-0000-0000-0000-000000000006',
    'A5 NM1 Citizen',
    'alive',
    'nation_manager',
    'a5200000-0000-0000-0000-000000000001',
    null
  ),
  -- NM of nation_2 (nm2_user – used for wrong-nation manager test)
  (
    'a5500000-0000-0000-0000-000000000005',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000002',
    'player_character',
    'a5000000-0000-0000-0000-000000000007',
    'A5 NM2 Citizen',
    'alive',
    'nation_manager',
    'a5200000-0000-0000-0000-000000000002',
    null
  ),
  -- NPC 1 in settlement_1 (for bulk assignment PC-last test)
  (
    'a5500000-0000-0000-0000-000000000006',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'npc',
    null,
    'A5 NPC One',
    'alive',
    'none',
    null,
    null
  ),
  -- NPC 2 in settlement_1 (pre-seeded on construction_project for T44-T46)
  (
    'a5500000-0000-0000-0000-000000000007',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'npc',
    null,
    'A5 NPC Two',
    'alive',
    'none',
    null,
    null
  ),
  -- NPC 3 in settlement_1 (spare unassigned NPC for T41 bulk standard job raise)
  (
    'a5500000-0000-0000-0000-000000000008',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'npc',
    null,
    'A5 NPC Three',
    'alive',
    'none',
    null,
    null
  ),
  -- NPC 4 in settlement_1 (spare unassigned NPC for T46 bulk construction raise)
  (
    'a5500000-0000-0000-0000-000000000009',
    'a5100000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'npc',
    null,
    'A5 NPC Four',
    'alive',
    'none',
    null,
    null
  );

-- Construction projects (one per settlement for wrong-side test)
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position
  )
values
  (
    'a5900000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'a5700000-0000-0000-0000-000000000001',
    'a5800000-0000-0000-0000-000000000001',
    'queued',
    1
  ),
  (
    'a5900000-0000-0000-0000-000000000002',
    'a5300000-0000-0000-0000-000000000002',
    'a5700000-0000-0000-0000-000000000001',
    'a5800000-0000-0000-0000-000000000001',
    'queued',
    1
  );

-- Settlement building in settlement_1
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
    'a5910000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'a5700000-0000-0000-0000-000000000001',
    'a5800000-0000-0000-0000-000000000001',
    'active',
    0
  );

-- Deposit instances: one in settlement_1, one in settlement_2 (for cross-settlement test)
insert into
  public.deposit_instances (
    id,
    settlement_id,
    deposit_type_id,
    name,
    status,
    max_workers
  )
values
  (
    'a5920000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'a5610000-0000-0000-0000-000000000001',
    'A5 Iron Vein Instance',
    'active',
    5
  ),
  (
    'a5920000-0000-0000-0000-000000000002',
    'a5300000-0000-0000-0000-000000000002',
    'a5610000-0000-0000-0000-000000000001',
    'A5 Iron Vein Instance 2',
    'active',
    5
  );

-- Deposit instance resources
insert into
  public.deposit_instance_resources (
    id,
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    'a5930000-0000-0000-0000-000000000001',
    'a5920000-0000-0000-0000-000000000001',
    'a5400000-0000-0000-0000-000000000001',
    500,
    500
  );

-- Managed population instance in settlement_1
insert into
  public.managed_population_instances (
    id,
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    configured_cull_quantity,
    status
  )
values
  (
    'a5940000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'a5620000-0000-0000-0000-000000000001',
    'A5 Cattle Herd',
    20,
    0,
    'active'
  );

-- Trade routes:
--   route_visible : settlement_1 (nation_1, not hidden) ↔ settlement_2 (nation_2, not hidden)
--   route_mixed   : settlement_1 (nation_1, not hidden) ↔ settlement_hmix (nation_hmix, hidden)
--   route_bothhid : settlement_hmix (hidden) ↔ settlement_hduo (hidden)
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
    status,
    proposed_by_citizen_id
  )
values
  (
    'a5960000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000002',
    'a5400000-0000-0000-0000-000000000001',
    10,
    'proposed',
    'a5500000-0000-0000-0000-000000000004'
  ),
  (
    'a5960000-0000-0000-0000-000000000002',
    'a5300000-0000-0000-0000-000000000001',
    'a5300000-0000-0000-0000-000000000003',
    'a5400000-0000-0000-0000-000000000001',
    5,
    'proposed',
    'a5500000-0000-0000-0000-000000000004'
  ),
  (
    'a5960000-0000-0000-0000-000000000003',
    'a5300000-0000-0000-0000-000000000003',
    'a5300000-0000-0000-0000-000000000004',
    'a5400000-0000-0000-0000-000000000001',
    3,
    'proposed',
    'a5500000-0000-0000-0000-000000000004'
  );

-- Pre-seed NPC assignments for the PC-rejection and bulk-assignment tests.
--   Standard-job test (T39-T41): npc_1 (NPC) → job_standard.
--   Construction test (T44-T46): npc_2 (NPC) → project_1.
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'a5500000-0000-0000-0000-000000000006',
    'standard_job',
    'a5600000-0000-0000-0000-000000000001',
    0
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    construction_project_id,
    assigned_on_turn_number
  )
values
  (
    'a5500000-0000-0000-0000-000000000007',
    'construction_project',
    'a5900000-0000-0000-0000-000000000001',
    0
  );

-- ===========================================================================
-- PART 1: RLS READ MATRIX
-- Seven Epic 5 tables × four role tiers (anon, outsider, PC-holder, SM).
-- Tests are numbered T1–T28.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Tier 1: anonymous (no policy applies → zero rows from every table)
-- ---------------------------------------------------------------------------
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

-- T1
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read settlement_resource_stockpiles'
  );

-- T2
select
  is (
    (
      select
        count(*)::integer
      from
        public.construction_projects
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read construction_projects'
  );

-- T3
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read settlement_buildings'
  );

-- T4
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read deposit_instances'
  );

-- T5
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = 'a5920000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read deposit_instance_resources'
  );

-- T6
select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read managed_population_instances'
  );

-- T7
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
    ),
    0,
    'anon cannot read trade_routes'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Tier 2: outsider — authenticated but no world access (no PC in world alpha,
-- world alpha is private, user is not owner/admin).
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- T8
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read settlement_resource_stockpiles'
  );

-- T9
select
  is (
    (
      select
        count(*)::integer
      from
        public.construction_projects
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read construction_projects'
  );

-- T10
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read settlement_buildings'
  );

-- T11
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read deposit_instances'
  );

-- T12
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = 'a5920000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read deposit_instance_resources'
  );

-- T13
select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read managed_population_instances'
  );

-- T14
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
    ),
    0,
    'outsider cannot read trade_routes'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Tier 3: PC-holder — pc_user has a living player_character in settlement_1
-- (world alpha). All seven tables should be readable.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000003","role":"authenticated"}';

-- T15
select
  ok (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ) >= 1,
    'PC-holder can read settlement_resource_stockpiles'
  );

-- T16
select
  is (
    (
      select
        count(*)::integer
      from
        public.construction_projects
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'PC-holder can read construction_projects'
  );

-- T17
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'PC-holder can read settlement_buildings'
  );

-- T18
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'PC-holder can read deposit_instances'
  );

-- T19
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = 'a5920000-0000-0000-0000-000000000001'
    ),
    1,
    'PC-holder can read deposit_instance_resources'
  );

-- T20
select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'PC-holder can read managed_population_instances'
  );

-- T21: pc_user sees route_visible and route_mixed (both have settlement_1 as
-- a visible endpoint) but NOT route_bothhid (both endpoints hidden).
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
    ),
    2,
    'PC-holder sees 2 of 3 trade routes (both-hidden pair excluded)'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Tier 4: Settlement Manager — sm1_user is the SM of settlement_1, which also
-- gives world access via their living player_character.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000004","role":"authenticated"}';

-- T22
select
  ok (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ) >= 1,
    'SM can read settlement_resource_stockpiles'
  );

-- T23
select
  is (
    (
      select
        count(*)::integer
      from
        public.construction_projects
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'SM can read construction_projects'
  );

-- T24
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'SM can read settlement_buildings'
  );

-- T25
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'SM can read deposit_instances'
  );

-- T26
select
  is (
    (
      select
        count(*)::integer
      from
        public.deposit_instance_resources
      where
        deposit_instance_id = 'a5920000-0000-0000-0000-000000000001'
    ),
    1,
    'SM can read deposit_instance_resources'
  );

-- T27
select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_instances
      where
        settlement_id = 'a5300000-0000-0000-0000-000000000001'
    ),
    1,
    'SM can read managed_population_instances'
  );

-- T28
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
    ),
    2,
    'SM sees same 2 trade routes as the PC-holder (both-hidden still excluded)'
  );

reset role;

-- ===========================================================================
-- PART 2: TRADE ROUTES BILATERAL VISIBILITY GAPS
-- Tests T29–T33 cover scenarios not exercised by trade_routes_rls_test.sql:
--   • route_mixed (origin visible, dest in hidden nation): user with general
--     world-alpha access sees it via the visible origin endpoint.
--   • route_bothhid (both endpoints hidden): PC user cannot see it; world
--     admin can (nation_visible_to_current_user bypasses is_hidden).
-- ===========================================================================
-- T29: pc_user CAN see route_mixed because its origin (settlement_1, nation_1,
-- not hidden) gives a visibility path even though the destination is in a
-- hidden nation.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        id = 'a5960000-0000-0000-0000-000000000002'
    ),
    1,
    'PC-holder sees route_mixed (one endpoint in hidden nation) via visible origin'
  );

-- T30: pc_user CANNOT see route_bothhid — both endpoints are in hidden nations
-- and pc_user holds no PC in either of those nations.
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        id = 'a5960000-0000-0000-0000-000000000003'
    ),
    0,
    'PC-holder cannot see route with both endpoints in hidden nations'
  );

reset role;

-- T31: sm2_user (PC in settlement_2, nation_2 — not party to route_mixed at
-- all) CAN see route_mixed because the origin (settlement_1, nation_1) is
-- visible and sm2_user has world-alpha access via their own living PC.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        id = 'a5960000-0000-0000-0000-000000000002'
    ),
    1,
    'third-party world-access user sees route_mixed via visible origin endpoint'
  );

reset role;

-- T32: world admin CAN see route_bothhid because is_world_admin(world_alpha)
-- satisfies nation_visible_to_current_user for both hidden nations.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
      where
        id = 'a5960000-0000-0000-0000-000000000003'
    ),
    1,
    'world admin sees route_bothhid (nation_visible_to_current_user is true for world admin)'
  );

-- T33: world admin sees all three trade routes.
select
  is (
    (
      select
        count(*)::integer
      from
        public.trade_routes
    ),
    3,
    'world admin sees all 3 trade routes including both-hidden pair'
  );

reset role;

-- ===========================================================================
-- PART 3: WRONG-SIDE MANAGER RPC REJECTIONS
-- sm2_user is the SM of settlement_2. All calls below reference settlement_1
-- or a resource that belongs to settlement_1. Each must raise 42501.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000005","role":"authenticated"}';

-- T34: set_bulk_standard_job_assignment — SM of wrong settlement
select
  throws_ok (
    $test$
    select * from public.set_bulk_standard_job_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'a5600000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'SM of wrong settlement cannot bulk-assign standard jobs'
  );

-- T35: set_bulk_construction_assignment — project is in settlement_1
select
  throws_ok (
    $test$
    select * from public.set_bulk_construction_assignment(
      'a5900000-0000-0000-0000-000000000001',
      1
    )
    $test$,
    '42501',
    null,
    'SM of wrong settlement cannot bulk-assign construction projects'
  );

-- T36: set_per_target_assignment (deposit) — deposit_1 is in settlement_1
select
  throws_ok (
    $test$
    select * from public.set_per_target_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'deposit',
      'a5920000-0000-0000-0000-000000000001',
      array[]::uuid[],
      null
    )
    $test$,
    '42501',
    null,
    'SM of wrong settlement cannot set_per_target_assignment for deposit'
  );

-- T37: set_per_target_assignment (husbandry) — mpi_1 is in settlement_1
select
  throws_ok (
    $test$
    select * from public.set_per_target_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'husbandry',
      'a5940000-0000-0000-0000-000000000001',
      array[]::uuid[],
      null
    )
    $test$,
    '42501',
    null,
    'SM of wrong settlement cannot set_per_target_assignment for husbandry'
  );

-- T38: set_per_target_assignment (trade_route) — specifying settlement_1 as
-- the operational settlement; sm2_user manages settlement_2, not settlement_1.
select
  throws_ok (
    $test$
    select * from public.set_per_target_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'trade_route',
      'a5960000-0000-0000-0000-000000000001',
      array[]::uuid[],
      'origin'
    )
    $test$,
    '42501',
    null,
    'SM of wrong settlement cannot set_per_target_assignment for trade_route'
  );

-- T42: set_per_target_assignment (culling) — mpi_1 is in settlement_1
select
  throws_ok (
    $test$
    select * from public.set_per_target_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'culling',
      'a5940000-0000-0000-0000-000000000001',
      array[]::uuid[],
      null
    )
    $test$,
    '42501',
    null,
    'SM of wrong settlement cannot set_per_target_assignment for culling'
  );

reset role;

-- ===========================================================================
-- PART 3b: CROSS-SETTLEMENT TARGET REJECTION
-- sm1_user is the authorised SM of settlement_1. Passing deposit_instance_2
-- (which belongs to settlement_2) as the target must raise P0001.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000004","role":"authenticated"}';

-- T43: deposit target belongs to a different settlement from p_settlement_id
select
  throws_ok (
    $test$
    select * from public.set_per_target_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'deposit',
      'a5920000-0000-0000-0000-000000000002',
      array[]::uuid[],
      null
    )
    $test$,
    'P0001',
    null,
    'set_per_target_assignment rejects deposit instance belonging to a different settlement'
  );

reset role;

-- ===========================================================================
-- PART 4: PC-NOT-ASSIGNABLE TRIGGER COVERAGE
-- T39-T41: trigger blocks direct PC inserts; NPCs and bulk RPCs still work.
-- T44-T46: same pattern for construction assignment path.
-- ===========================================================================
-- T39: trigger rejects direct insert of nm1_citizen (PC) into citizen_assignments
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, job_id, assigned_on_turn_number
    ) values (
      'a5500000-0000-0000-0000-000000000004',
      'standard_job',
      'a5600000-0000-0000-0000-000000000001',
      0
    )
    $test$,
    'P0001',
    null,
    'trigger rejects direct PC insert for standard_job'
  );

-- T40: NPC (npc_1) assignment to job_standard exists (pre-seeded; trigger permits NPC)
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'a5500000-0000-0000-0000-000000000006'
        and assignment_type = 'standard_job'
    ),
    1,
    'NPC assignment to standard_job is present (trigger allows NPC)'
  );

-- T41: set_bulk_standard_job_assignment raise succeeds (picks NPC, not PC)
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select * from public.set_bulk_standard_job_assignment(
      'a5300000-0000-0000-0000-000000000001',
      'a5600000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'world admin can raise bulk standard job assignment (NPCs only)'
  );

reset role;

-- T44: trigger rejects direct insert of sm1_citizen (PC) into construction_project
select
  throws_ok (
    $test$
    insert into public.citizen_assignments (
      citizen_id, assignment_type, construction_project_id, assigned_on_turn_number
    ) values (
      'a5500000-0000-0000-0000-000000000002',
      'construction_project',
      'a5900000-0000-0000-0000-000000000001',
      0
    )
    $test$,
    'P0001',
    null,
    'trigger rejects direct PC insert for construction_project'
  );

-- T45: NPC (npc_2) assignment to construction_project_1 exists (pre-seeded)
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'a5500000-0000-0000-0000-000000000007'
        and assignment_type = 'construction_project'
    ),
    1,
    'NPC assignment to construction_project is present (trigger allows NPC)'
  );

-- T46: set_bulk_construction_assignment raise succeeds (picks NPC, not PC)
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select * from public.set_bulk_construction_assignment(
      'a5900000-0000-0000-0000-000000000001',
      2
    )
    $test$,
    'world admin can raise bulk construction assignment (NPCs only)'
  );

reset role;

-- ===========================================================================
-- PART 5: CROSS-WORLD WRITE REJECT
-- world_A admin (owner of world_A) must be denied writing a stockpile row for
-- settlement_B (which belongs to world_B). The INSERT policy checks
-- is_world_admin(n.world_id) against the target settlement's world.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- T47: world_A admin cannot insert a stockpile for a settlement in world_B
select
  throws_ok (
    $test$
    insert into public.settlement_resource_stockpiles (
      settlement_id, resource_id, quantity
    ) values (
      'a5300000-0000-0000-0000-000000000005',
      'a5400000-0000-0000-0000-000000000001',
      0
    )
    $test$,
    '42501',
    null,
    'world_A admin cannot write stockpile rows for a settlement in world_B'
  );

reset role;

select
  *
from
  finish ();

rollback;
