-- pgTAP tests for public.add_settlement_building_as_admin RPC.
-- Run with: npx supabase test db
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ab-prefixed, unique to this file):
--   ab1xxxxx = users          ab2xxxxx = worlds
--   ab3xxxxx = nations        ab4xxxxx = settlements
--   ab5xxxxx = blueprints     ab6xxxxx = tiers
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
    'ab100000-0000-0000-0000-000000000001',
    'asb-superadmin@example.com',
    'x',
    now(),
    '{"username":"asb_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ab100000-0000-0000-0000-000000000002',
    'asb-world-admin@example.com',
    'x',
    now(),
    '{"username":"asb_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'ab100000-0000-0000-0000-000000000003',
    'asb-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"asb_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'ab100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ab200000-0000-0000-0000-000000000001',
    'ASB World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ab200000-0000-0000-0000-000000000001',
    'ab100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ab300000-0000-0000-0000-000000000001',
    'ab200000-0000-0000-0000-000000000001',
    'ASB Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ab400000-0000-0000-0000-000000000001',
    'ab300000-0000-0000-0000-000000000001',
    'ASB Settlement'
  );

-- Settlement manager citizen
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_settlement_id
  )
values
  (
    'ab100000-0000-0000-0000-000000000099',
    'ab200000-0000-0000-0000-000000000001',
    'player_character',
    'ASB Settlement Manager PC',
    'alive',
    'ab100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'ab400000-0000-0000-0000-000000000001'
  );

-- Blueprint with two tiers
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'ab500000-0000-0000-0000-000000000001',
    'ab200000-0000-0000-0000-000000000001',
    'ASB Housing',
    'asb-housing'
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
    'ab600000-0000-0000-0000-000000000001',
    'ab500000-0000-0000-0000-000000000001',
    1,
    10,
    '[{"type":"population_cap_increase","amount":10}]'::jsonb
  ),
  (
    'ab600000-0000-0000-0000-000000000002',
    'ab500000-0000-0000-0000-000000000001',
    2,
    20,
    '[{"type":"population_cap_increase","amount":20}]'::jsonb
  );

-- Trashed blueprint for error-contract tests
insert into
  public.building_blueprints (id, world_id, name, slug, is_trashed)
values
  (
    'ab500000-0000-0000-0000-000000000002',
    'ab200000-0000-0000-0000-000000000001',
    'ASB Trashed',
    'asb-trashed',
    true
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
    'ab600000-0000-0000-0000-000000000003',
    'ab500000-0000-0000-0000-000000000002',
    1,
    5,
    '[]'::jsonb
  );

-- ===========================================================================
-- SUPER ADMIN: can add a building and gets back the new id
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.add_settlement_building_as_admin (
          'ab400000-0000-0000-0000-000000000001',
          'ab500000-0000-0000-0000-000000000001',
          'ab600000-0000-0000-0000-000000000001',
          'Super Admin House'
        )
    ),
    1,
    'super admin can add a building; RPC returns one row'
  );

reset role;

-- ===========================================================================
-- Verify the building was inserted with correct fields
-- ===========================================================================
select
  is (
    (
      select
        state
      from
        public.settlement_buildings
      where
        settlement_id = 'ab400000-0000-0000-0000-000000000001'
        and building_blueprint_id = 'ab500000-0000-0000-0000-000000000001'
        and name = 'Super Admin House'
    ),
    'active',
    'inserted building has state active and name stored'
  );

-- ===========================================================================
-- WORLD ADMIN: can add a building
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.add_settlement_building_as_admin(
      'ab400000-0000-0000-0000-000000000001',
      'ab500000-0000-0000-0000-000000000001',
      'ab600000-0000-0000-0000-000000000002'
    )
    $test$,
    'world admin can add a building (no name)'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.add_settlement_building_as_admin(
      'ab400000-0000-0000-0000-000000000001',
      'ab500000-0000-0000-0000-000000000001',
      'ab600000-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'settlement manager is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- TRASHED BLUEPRINT: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ab100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.add_settlement_building_as_admin(
      'ab400000-0000-0000-0000-000000000001',
      'ab500000-0000-0000-0000-000000000002',
      'ab600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'trashed blueprint is rejected with P0001'
  );

-- ===========================================================================
-- TIER FROM WRONG BLUEPRINT: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.add_settlement_building_as_admin(
      'ab400000-0000-0000-0000-000000000001',
      'ab500000-0000-0000-0000-000000000001',
      'ab600000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0002',
    null,
    'tier from a different blueprint is rejected with P0002'
  );

-- ===========================================================================
-- NON-EXISTENT SETTLEMENT: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.add_settlement_building_as_admin(
      'ab400000-0000-0000-0000-999999999999',
      'ab500000-0000-0000-0000-000000000001',
      'ab600000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'non-existent settlement is rejected with P0002'
  );

reset role;

select
  *
from
  finish ();

rollback;
