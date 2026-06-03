-- pgTAP tests for public.settlement_buildings RLS and tier-blueprint mismatch trigger.
-- Run with: npx supabase test db
begin;

select
  plan (11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   b1xxxxxx = users          b2xxxxxx = worlds
--   b3xxxxxx = nations        b4xxxxxx = settlements
--   b5xxxxxx = blueprints     b6xxxxxx = tiers
--   b7xxxxxx = buildings      b8xxxxxx = citizens
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
    'b1000000-0000-0000-0000-000000000001',
    'sb-owner@example.com',
    'x',
    now(),
    '{"username":"sb_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'sb-admin@example.com',
    'x',
    now(),
    '{"username":"sb_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'sb-outsider@example.com',
    'x',
    now(),
    '{"username":"sb_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'sb-super@example.com',
    'x',
    now(),
    '{"username":"sb_super"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'sb-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"sb_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000006',
    'sb-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"sb_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'SB Private World',
    'b1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'SB Outsider World',
    'b1000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'SB Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b4000000-0000-0000-0000-000000000001',
    'b3000000-0000-0000-0000-000000000001',
    'SB Settlement'
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'b5000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'SB Barracks',
    'sb-barracks'
  ),
  (
    'b5000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000001',
    'SB Farmhouse',
    'sb-farmhouse'
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
    'b6000000-0000-0000-0000-000000000001',
    'b5000000-0000-0000-0000-000000000001',
    1,
    10
  ),
  (
    'b6000000-0000-0000-0000-000000000002',
    'b5000000-0000-0000-0000-000000000002',
    1,
    5
  );

-- Nation manager and settlement manager citizens.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    'b8000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'player_character',
    'SB Nation Manager PC',
    'alive',
    'b1000000-0000-0000-0000-000000000005',
    'nation_manager',
    'b3000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'b8000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000001',
    'player_character',
    'SB Settlement Manager PC',
    'alive',
    'b1000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    'b4000000-0000-0000-0000-000000000001'
  );

-- Seed one active building as postgres so read tests have a visible row.
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
    'b7000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'b5000000-0000-0000-0000-000000000001',
    'b6000000-0000-0000-0000-000000000001',
    'active',
    1
  );

-- ===========================================================================
-- ANONYMOUS: cannot read settlement_buildings
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings
    ),
    0,
    'anon cannot read settlement_buildings'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read private-world buildings
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.settlement_buildings sb
        join public.settlements s on s.id = sb.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = 'b2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read settlement_buildings in an inaccessible private world'
  );

reset role;

-- ===========================================================================
-- WORLD OWNER: can read buildings in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_buildings
      where
        id = 'b7000000-0000-0000-0000-000000000001'
    ),
    'world owner can read settlement_buildings in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can insert, update, and delete
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
    values (
      'b7000000-0000-0000-0000-000000000010',
      'b4000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000001',
      'b6000000-0000-0000-0000-000000000001',
      'active',
      2
    )
  $test$,
    'world admin can insert a settlement building'
  );

select
  lives_ok (
    $test$
    update public.settlement_buildings
    set state = 'suspended'
    where id = 'b7000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update a settlement building'
  );

select
  lives_ok (
    $test$
    delete from public.settlement_buildings
    where id = 'b7000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can delete a settlement building'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can insert buildings in any world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
    values (
      'b7000000-0000-0000-0000-000000000011',
      'b4000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000001',
      'b6000000-0000-0000-0000-000000000001',
      'active',
      3
    )
  $test$,
    'super admin can insert a settlement building'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.settlement_buildings (settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000001',
      'b6000000-0000-0000-0000-000000000001',
      'active',
      4
    )
  $test$,
    '42501',
    null,
    'nation manager cannot directly insert settlement_buildings rows'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.settlement_buildings (settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000001',
      'b6000000-0000-0000-0000-000000000001',
      'active',
      5
    )
  $test$,
    '42501',
    null,
    'settlement manager cannot directly insert settlement_buildings rows'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD: world admin of a different world cannot write buildings for
-- settlements outside their administered world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.settlement_buildings (settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000001',
      'b6000000-0000-0000-0000-000000000001',
      'active',
      6
    )
  $test$,
    '42501',
    null,
    'world admin of a different world cannot insert building for settlement in another world'
  );

reset role;

-- ===========================================================================
-- TIER-BLUEPRINT MISMATCH: current_tier_id must belong to building_blueprint_id.
-- Tier b6...02 belongs to Farmhouse (b5...02), not Barracks (b5...01).
-- Run as postgres to isolate only the trigger constraint.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.settlement_buildings (settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000001',
      'b6000000-0000-0000-0000-000000000002',
      'active',
      7
    )
  $test$,
    '23514',
    null,
    'tier belonging to a different blueprint is rejected by the tier_match trigger'
  );

select
  *
from
  finish ();

rollback;
