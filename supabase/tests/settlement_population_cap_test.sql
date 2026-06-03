-- pgTAP tests for public.settlement_population_cap helper function.
-- Run with: npx supabase test db
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   d2xxxxxx = worlds         d3xxxxxx = nations
--   d4xxxxxx = settlements    d5xxxxxx = blueprints
--   d6xxxxxx = tiers          d7xxxxxx = buildings
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
    'popcap-owner@example.com',
    'x',
    now(),
    '{"username":"popcap_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'PopCap World',
    'd1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'PopCap Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'PopCap Settlement'
  );

-- Blueprint with a tier that grants population_cap_increase effects.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'PopCap Housing',
    'popcap-housing'
  );

-- Tier grants +50 population cap per active instance.
insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required,
    effects_json
  )
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    1,
    10,
    '[{"type":"population_cap_increase","amount":50}]'::jsonb
  );

-- ===========================================================================
-- TEST 1: settlement with no buildings returns 0
-- ===========================================================================
select
  is (
    public.settlement_population_cap ('d4000000-0000-0000-0000-000000000001'),
    0::numeric,
    'settlement_population_cap returns 0 when no buildings exist'
  );

-- Seed two active buildings and one suspended, one auto_deconstructed.
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
    'd7000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'active',
    1
  ),
  (
    'd7000000-0000-0000-0000-000000000002',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'active',
    1
  ),
  (
    'd7000000-0000-0000-0000-000000000003',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'suspended',
    1
  ),
  (
    'd7000000-0000-0000-0000-000000000004',
    'd4000000-0000-0000-0000-000000000001',
    'd5000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000001',
    'auto_deconstructed',
    1
  );

-- ===========================================================================
-- TEST 2: two active buildings each granting 50 → total 100
-- ===========================================================================
select
  is (
    public.settlement_population_cap ('d4000000-0000-0000-0000-000000000001'),
    100::numeric,
    'settlement_population_cap sums only active buildings (2 × 50 = 100)'
  );

-- Deactivate the first active building to verify suspended is excluded.
update public.settlement_buildings
set
  state = 'suspended'
where
  id = 'd7000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- TEST 3: suspended buildings are excluded from the sum
-- ===========================================================================
select
  is (
    public.settlement_population_cap ('d4000000-0000-0000-0000-000000000001'),
    50::numeric,
    'settlement_population_cap excludes suspended buildings'
  );

-- Manually deconstruct the remaining active building.
update public.settlement_buildings
set
  state = 'manually_deconstructed'
where
  id = 'd7000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- TEST 4: manually_deconstructed buildings are excluded → returns 0
-- ===========================================================================
select
  is (
    public.settlement_population_cap ('d4000000-0000-0000-0000-000000000001'),
    0::numeric,
    'settlement_population_cap excludes manually_deconstructed buildings and returns 0'
  );

select
  *
from
  finish ();

rollback;
