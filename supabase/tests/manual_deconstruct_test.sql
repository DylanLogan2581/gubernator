-- pgTAP tests for public.manual_deconstruct_settlement_building RPC.
-- Run with: npx supabase test db
begin;

select
  plan (9);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all aa-prefixed, unique to this file):
--   aa1xxxxx = users          aa2xxxxx = worlds
--   aa3xxxxx = nations        aa4xxxxx = settlements
--   aa5xxxxx = blueprints     aa6xxxxx = tiers
--   aa7xxxxx = buildings      aa8xxxxx = citizens
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
    'aa100000-0000-0000-0000-000000000001',
    'mdt-superadmin@example.com',
    'x',
    now(),
    '{"username":"mdt_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'aa100000-0000-0000-0000-000000000002',
    'mdt-world-admin@example.com',
    'x',
    now(),
    '{"username":"mdt_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'aa100000-0000-0000-0000-000000000003',
    'mdt-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"mdt_settlement_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'aa100000-0000-0000-0000-000000000004',
    'mdt-outsider@example.com',
    'x',
    now(),
    '{"username":"mdt_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'aa100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'aa200000-0000-0000-0000-000000000001',
    'MDT World',
    'aa100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'aa200000-0000-0000-0000-000000000001',
    'aa100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'aa300000-0000-0000-0000-000000000001',
    'aa200000-0000-0000-0000-000000000001',
    'MDT Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'aa400000-0000-0000-0000-000000000001',
    'aa300000-0000-0000-0000-000000000001',
    'MDT Settlement'
  );

-- Settlement manager citizen
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_settlement_id
  )
values
  (
    'aa800000-0000-0000-0000-000000000001',
    'aa200000-0000-0000-0000-000000000001',
    'player_character',
    'MDT Settlement Manager PC',
    'alive',
    'aa100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'aa400000-0000-0000-0000-000000000001'
  );

-- Blueprint with a tier that grants +10 population cap per active instance
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'aa500000-0000-0000-0000-000000000001',
    'aa200000-0000-0000-0000-000000000001',
    'MDT Housing',
    'mdt-housing'
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
    'aa600000-0000-0000-0000-000000000001',
    'aa500000-0000-0000-0000-000000000001',
    1,
    10,
    '[{"type":"population_cap_increase","amount":10}]'::jsonb
  );

-- Buildings: one active (for success test), one suspended, one already-deconstructed
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
    'aa700000-0000-0000-0000-000000000001',
    'aa400000-0000-0000-0000-000000000001',
    'aa500000-0000-0000-0000-000000000001',
    'aa600000-0000-0000-0000-000000000001',
    'active',
    1
  ),
  (
    'aa700000-0000-0000-0000-000000000002',
    'aa400000-0000-0000-0000-000000000001',
    'aa500000-0000-0000-0000-000000000001',
    'aa600000-0000-0000-0000-000000000001',
    'suspended',
    1
  ),
  (
    'aa700000-0000-0000-0000-000000000003',
    'aa400000-0000-0000-0000-000000000001',
    'aa500000-0000-0000-0000-000000000001',
    'aa600000-0000-0000-0000-000000000001',
    'manually_deconstructed',
    1
  );

-- ===========================================================================
-- SUPER ADMIN: can deconstruct an active building
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        settlement_building_id
      from
        public.manual_deconstruct_settlement_building ('aa700000-0000-0000-0000-000000000001')
    ),
    'aa700000-0000-0000-0000-000000000001'::uuid,
    'super admin can deconstruct an active building; returns settlement_building_id'
  );

reset role;

-- ===========================================================================
-- Confirm state changed to manually_deconstructed
-- ===========================================================================
select
  is (
    (
      select
        state
      from
        public.settlement_buildings
      where
        id = 'aa700000-0000-0000-0000-000000000001'
    ),
    'manually_deconstructed',
    'state is manually_deconstructed after RPC call'
  );

-- ===========================================================================
-- WORLD ADMIN: can deconstruct a suspended building
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.manual_deconstruct_settlement_building(
      'aa700000-0000-0000-0000-000000000002'
    )
    $test$,
    'world admin can deconstruct a suspended building'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.manual_deconstruct_settlement_building(
      'aa700000-0000-0000-0000-000000000003'
    )
    $test$,
    '42501',
    null,
    'settlement manager is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ANONYMOUS: rejected (42501)
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.manual_deconstruct_settlement_building(
      'aa700000-0000-0000-0000-000000000003'
    )
    $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ALREADY DECONSTRUCTED: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.manual_deconstruct_settlement_building(
      'aa700000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'already-deconstructed building is rejected with P0001'
  );

-- ===========================================================================
-- NOT FOUND: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.manual_deconstruct_settlement_building(
      'aa700000-0000-0000-0000-999999999999'
    )
    $test$,
    'P0002',
    null,
    'non-existent building is rejected with P0002'
  );

reset role;

-- ===========================================================================
-- OVERSHOOT LOG: deconstruct a building that drops cap below citizen count
-- Insert 15 alive citizens and two active buildings (cap = 10 each → 20 total).
-- After deconstructing one: cap = 10, citizens = 15 → overshoot → log row expected.
-- ===========================================================================
-- Insert two active buildings so cap is 20 (two active × 10)
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
    'aa700000-0000-0000-0000-000000000010',
    'aa400000-0000-0000-0000-000000000001',
    'aa500000-0000-0000-0000-000000000001',
    'aa600000-0000-0000-0000-000000000001',
    'active',
    2
  ),
  (
    'aa700000-0000-0000-0000-000000000011',
    'aa400000-0000-0000-0000-000000000001',
    'aa500000-0000-0000-0000-000000000001',
    'aa600000-0000-0000-0000-000000000001',
    'active',
    2
  );

-- Insert 15 alive citizens in the settlement
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status
  )
select
  (
    'aa800000-0000-0000-' || lpad(i::text, 4, '0') || '-000000000010'
  )::uuid,
  'aa200000-0000-0000-0000-000000000001',
  'aa400000-0000-0000-0000-000000000001',
  'npc',
  'Citizen ' || i,
  'alive'
from
  generate_series(1, 15) as s (i);

-- Cap is 20 (2 active buildings × 10). Deconstruct one → cap = 10, citizens = 15.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.manual_deconstruct_settlement_building(
      'aa700000-0000-0000-0000-000000000010'
    )
    $test$,
    'overshoot test: deconstruct succeeds'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        log_category = 'manual_deconstruct_overshoot'
        and settlement_id = 'aa400000-0000-0000-0000-000000000001'
        and (payload_jsonb ->> 'current_citizens')::integer = 15
        and (payload_jsonb ->> 'new_cap')::numeric = 10
    ),
    1,
    'overshoot log row written when citizen count exceeds new population cap'
  );

select
  *
from
  finish ();

rollback;
