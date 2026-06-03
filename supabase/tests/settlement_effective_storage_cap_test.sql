-- pgTAP tests for public.settlement_effective_storage_cap helper function.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all 6e-prefixed, unique to this file):
--   6e1xxxxx = users          6e2xxxxx = worlds
--   6e3xxxxx = nations        6e4xxxxx = settlements
--   6e5xxxxx = resources      6e6xxxxx = blueprints
--   6e7xxxxx = tiers          6e8xxxxx = buildings
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
    '6e100000-0000-0000-0000-000000000001',
    'sesc-owner@example.com',
    'x',
    now(),
    '{"username":"sesc_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '6e200000-0000-0000-0000-000000000001',
    'SESC World',
    '6e100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '6e300000-0000-0000-0000-000000000001',
    '6e200000-0000-0000-0000-000000000001',
    'SESC Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '6e400000-0000-0000-0000-000000000001',
    '6e300000-0000-0000-0000-000000000001',
    'SESC Settlement'
  );

-- Resource A: cap = 100 (used for storage-increase tests).
-- Resource B: cap = 50 (used for non-matching-resource test).
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    '6e500000-0000-0000-0000-000000000001',
    '6e200000-0000-0000-0000-000000000001',
    'SESC Iron Ore',
    'sesc-iron-ore',
    100
  ),
  (
    '6e500000-0000-0000-0000-000000000002',
    '6e200000-0000-0000-0000-000000000001',
    'SESC Timber',
    'sesc-timber',
    50
  );

-- Blueprint 1: tier carries two resource_storage_increase effects for resource A
--              (+50 and +20), verifying that multiple entries in effects_json are summed.
-- Blueprint 2: tier carries one resource_storage_increase effect for resource A (+30),
--              used to verify stacking across multiple buildings.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    '6e600000-0000-0000-0000-000000000001',
    '6e200000-0000-0000-0000-000000000001',
    'SESC Warehouse',
    'sesc-warehouse'
  ),
  (
    '6e600000-0000-0000-0000-000000000002',
    '6e200000-0000-0000-0000-000000000001',
    'SESC Granary',
    'sesc-granary'
  );

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
    '6e700000-0000-0000-0000-000000000001',
    '6e600000-0000-0000-0000-000000000001',
    1,
    10,
    '[{"type":"resource_storage_increase","resource_id":"6e500000-0000-0000-0000-000000000001","amount":50},{"type":"resource_storage_increase","resource_id":"6e500000-0000-0000-0000-000000000001","amount":20}]'::jsonb
  ),
  (
    '6e700000-0000-0000-0000-000000000002',
    '6e600000-0000-0000-0000-000000000002',
    1,
    10,
    '[{"type":"resource_storage_increase","resource_id":"6e500000-0000-0000-0000-000000000001","amount":30}]'::jsonb
  );

-- ===========================================================================
-- TEST 1: no buildings — returns base_stockpile_cap only
-- ===========================================================================
select
  is (
    public.settlement_effective_storage_cap (
      '6e400000-0000-0000-0000-000000000001',
      '6e500000-0000-0000-0000-000000000001'
    ),
    100::numeric,
    'settlement_effective_storage_cap returns base_stockpile_cap when no buildings exist'
  );

-- Insert building 1 (Warehouse, two effects totalling +70 for resource A).
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
    '6e800000-0000-0000-0000-000000000001',
    '6e400000-0000-0000-0000-000000000001',
    '6e600000-0000-0000-0000-000000000001',
    '6e700000-0000-0000-0000-000000000001',
    'active',
    1
  );

-- ===========================================================================
-- TEST 2: one active building with two resource_storage_increase entries
--         summed within a single tier's effects_json (100 + 50 + 20 = 170)
-- ===========================================================================
select
  is (
    public.settlement_effective_storage_cap (
      '6e400000-0000-0000-0000-000000000001',
      '6e500000-0000-0000-0000-000000000001'
    ),
    170::numeric,
    'settlement_effective_storage_cap sums multiple effects in a single tier (100 + 50 + 20 = 170)'
  );

-- Insert building 2 (Granary, +30 for resource A).
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
    '6e800000-0000-0000-0000-000000000002',
    '6e400000-0000-0000-0000-000000000001',
    '6e600000-0000-0000-0000-000000000002',
    '6e700000-0000-0000-0000-000000000002',
    'active',
    1
  );

-- ===========================================================================
-- TEST 3: multiple active buildings stack (100 + 50 + 20 + 30 = 200)
-- ===========================================================================
select
  is (
    public.settlement_effective_storage_cap (
      '6e400000-0000-0000-0000-000000000001',
      '6e500000-0000-0000-0000-000000000001'
    ),
    200::numeric,
    'settlement_effective_storage_cap stacks effects across multiple active buildings (100 + 70 + 30 = 200)'
  );

-- ===========================================================================
-- TEST 4: non-matching resource_id — building effects for resource A do not
--         contribute to resource B's cap
-- ===========================================================================
select
  is (
    public.settlement_effective_storage_cap (
      '6e400000-0000-0000-0000-000000000001',
      '6e500000-0000-0000-0000-000000000002'
    ),
    50::numeric,
    'settlement_effective_storage_cap returns only base_stockpile_cap for non-matching resource_id'
  );

-- ===========================================================================
-- TEST 5: function is SECURITY DEFINER
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'settlement_effective_storage_cap'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'settlement_effective_storage_cap is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
