-- pgTAP tests for the upgrade path of public.create_construction_project (#1372).
-- Run with: npx supabase test db
begin;

select
  plan (8);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all f-prefixed, unique to this file):
--   f1xxxxxx = users        f2xxxxxx = worlds     f3xxxxxx = nations
--   f4xxxxxx = settlements   f5xxxxxx = blueprints f6xxxxxx = tiers
--   f7xxxxxx = buildings     f8xxxxxx = citizens
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
    'f1000000-0000-0000-0000-000000000005',
    'ccpu-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"ccpu_settlement_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'CCPU World',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'CCPU Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'CCPU Settlement'
  );

insert into
  public.building_blueprints (
    id,
    world_id,
    name,
    slug,
    max_instances_per_settlement,
    is_trashed
  )
values
  -- Multi-tier blueprint (upgradeable)
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Tower',
    'tower-ccpu',
    null,
    false
  ),
  -- Capped blueprint (max 1) for the cap-exemption test
  (
    'f5000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Keep',
    'keep-ccpu',
    1,
    false
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
    'f6000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    1,
    10
  ),
  (
    'f6000000-0000-0000-0000-000000000002',
    'f5000000-0000-0000-0000-000000000001',
    2,
    20
  ),
  (
    'f6000000-0000-0000-0000-000000000011',
    'f5000000-0000-0000-0000-000000000002',
    1,
    10
  ),
  (
    'f6000000-0000-0000-0000-000000000012',
    'f5000000-0000-0000-0000-000000000002',
    2,
    20
  );

-- Active tier-1 building of the Tower blueprint (upgrade target)
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    missed_upkeep_count,
    activated_on_turn_number
  )
values
  (
    'f7000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'active',
    0,
    1
  ),
  -- Active tier-1 building of the capped Keep blueprint (fills its cap of 1)
  (
    'f7000000-0000-0000-0000-000000000002',
    'f4000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000002',
    'f6000000-0000-0000-0000-000000000011',
    'active',
    0,
    1
  );

-- Settlement manager PC
insert into
  public.citizens (
    id,
    world_id,
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
    'f8000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'player_character',
    'CCPU Settlement Manager PC',
    'alive',
    'f1000000-0000-0000-0000-000000000005',
    'settlement_manager',
    null,
    'f4000000-0000-0000-0000-000000000001'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';

-- ===========================================================================
-- Success: settlement manager upgrades the tier-1 building to tier 2
-- ===========================================================================
select
  is (
    (
      select
        (
          public.create_construction_project (
            'f4000000-0000-0000-0000-000000000001',
            'f5000000-0000-0000-0000-000000000001',
            'f6000000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000001'
          )
        ).upgrade_settlement_building_id
    ),
    'f7000000-0000-0000-0000-000000000001'::uuid,
    'upgrade project records the settlement_building being upgraded'
  );

-- ===========================================================================
-- Second concurrent upgrade of the same building: rejected (P0001)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000002',
      'f7000000-0000-0000-0000-000000000001'
    )
  $test$,
    'P0001',
    null,
    'a second in-flight upgrade of the same building is rejected with P0001'
  );

-- ===========================================================================
-- Target tier not higher than current tier: rejected (P0001)
-- (upgrade tier-1 building to tier 1)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000001',
      'f7000000-0000-0000-0000-000000000001'
    )
  $test$,
    'P0001',
    null,
    'upgrading to a tier that is not higher than the current tier is rejected with P0001'
  );

-- ===========================================================================
-- Upgrade building not found: rejected (P0002)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000002',
      'f7000000-0000-0000-0000-0000000000ff'
    )
  $test$,
    'P0002',
    null,
    'upgrading a non-existent building is rejected with P0002'
  );

-- ===========================================================================
-- Upgrade building belongs to a different blueprint: rejected (P0002)
-- (Keep building f700...02 upgraded via Tower blueprint f500...01)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000002',
      'f7000000-0000-0000-0000-000000000002'
    )
  $test$,
    'P0002',
    null,
    'upgrade building whose blueprint differs from p_blueprint_id is rejected with P0002'
  );

-- ===========================================================================
-- Upgrade exempt from max_instances: the Keep is capped at 1 and already has
-- one active building, yet upgrading that building to tier 2 is allowed.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000002',
      'f6000000-0000-0000-0000-000000000012',
      'f7000000-0000-0000-0000-000000000002'
    )
  $test$,
    'upgrading a building is exempt from the blueprint instance cap'
  );

-- ===========================================================================
-- Direct build of the capped Keep still rejected (23514) — cap unaffected.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000002',
      'f6000000-0000-0000-0000-000000000011'
    )
  $test$,
    '23514',
    null,
    'direct-build of a capped blueprint is still rejected while upgrades are exempt'
  );

-- ===========================================================================
-- Upgrade building not active: rejected (P0001)
-- Suspend the Tower building, then attempt to upgrade it.
-- ===========================================================================
reset role;

update public.settlement_buildings
set
  state = 'suspended'
where
  id = 'f7000000-0000-0000-0000-000000000001';

-- Clear the in-flight upgrade so the "already upgrading" guard doesn't mask this.
update public.construction_projects
set
  status = 'cancelled'
where
  upgrade_settlement_building_id = 'f7000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_construction_project(
      'f4000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000001',
      'f6000000-0000-0000-0000-000000000002',
      'f7000000-0000-0000-0000-000000000001'
    )
  $test$,
    'P0001',
    null,
    'upgrading a non-active building is rejected with P0001'
  );

reset role;

select
  *
from
  finish ();

rollback;
