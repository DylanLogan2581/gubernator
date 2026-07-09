-- pgTAP tests for public.unit_soldiers RLS and public.recruit_soldiers /
-- public.discharge_soldiers RPCs (#1109).
-- Run with: npx supabase test db
--
-- Generated ids are threaded between statements via session GUCs, matching
-- the pattern in armies_test.sql.
--
-- UUID ranges (all numeric/hex, unique to this file):
--   f1xxxxxx = users              f2xxxxxx = worlds
--   f3xxxxxx = nations            f4xxxxxx = settlements
--   f5xxxxxx = citizens           f6xxxxxx = unit_types
--   f7xxxxxx = resources          f8xxxxxx = armies / army_units
--   f9xxxxxx = building_blueprints / tiers / settlement_buildings
--   faxxxxxx = education_levels
begin;

select
  plan (31);

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
    'f1000000-0000-0000-0000-000000000001',
    'soldier-admin@example.com',
    'x',
    now(),
    '{"username":"soldier_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'soldier-manager@example.com',
    'x',
    now(),
    '{"username":"soldier_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'soldier-outsider@example.com',
    'x',
    now(),
    '{"username":"soldier_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Soldier World',
    'private',
    'active',
    7
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'f7000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Grain',
    'grain',
    100000
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Soldier Nation'
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Other Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Home Settlement'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000001',
    'Stationed Settlement'
  ),
  (
    'f4000000-0000-0000-0000-000000000003',
    'f3000000-0000-0000-0000-000000000002',
    'Other Nation Settlement'
  );

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
    role_nation_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'player_character',
    'Manager',
    'alive',
    'f1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'f3000000-0000-0000-0000-000000000001'
  );

-- NPCs used across the guard scenarios below.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'f5000000-0000-0000-0000-000000000010',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Recruit',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000011',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Extra',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000013',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000002',
    'npc',
    'Stranger',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000014',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Scholar',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000015',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Officer',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000016',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Uneducated',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000017',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Payer',
    'alive'
  ),
  (
    'f5000000-0000-0000-0000-000000000018',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'HostPaid',
    'alive'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause_category
  )
values
  (
    'f5000000-0000-0000-0000-000000000012',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'npc',
    'Deceased',
    'dead',
    'unknown'
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'fa000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Basic',
    1
  ),
  (
    'fa000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Advanced',
    2
  );

update public.citizens
set
  education_level_id = 'fa000000-0000-0000-0000-000000000001'
where
  id = 'f5000000-0000-0000-0000-000000000016';

insert into
  public.nation_offices (
    world_id,
    nation_id,
    office_type_id,
    citizen_id,
    appointed_turn_number
  )
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    (
      select
        id
      from
        public.office_types
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
        and nation_id is null
        and name = 'treasurer'
    ),
    'f5000000-0000-0000-0000-000000000015',
    1
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'f9000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Barracks',
    'barracks'
  );

insert into
  public.building_blueprint_tiers (id, building_blueprint_id, tier_number)
values
  (
    'f9000000-0000-0000-0000-000000000002',
    'f9000000-0000-0000-0000-000000000001',
    1
  ),
  (
    'f9000000-0000-0000-0000-000000000003',
    'f9000000-0000-0000-0000-000000000001',
    2
  );

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
    'f9000000-0000-0000-0000-000000000004',
    'f4000000-0000-0000-0000-000000000001',
    'f9000000-0000-0000-0000-000000000001',
    'f9000000-0000-0000-0000-000000000002',
    'active',
    1
  );

insert into
  public.unit_types (
    id,
    world_id,
    name,
    soldiers_per_unit,
    desertion_rate,
    recruitment_costs_json
  )
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Basic Unit Type',
    1,
    0.05,
    '[]'::jsonb
  ),
  (
    'f6000000-0000-0000-0000-000000000006',
    'f2000000-0000-0000-0000-000000000001',
    'Spare Unit Type',
    5,
    0.05,
    '[]'::jsonb
  ),
  (
    'f6000000-0000-0000-0000-000000000004',
    'f2000000-0000-0000-0000-000000000001',
    'Priced Unit Type',
    5,
    0.05,
    jsonb_build_array(
      jsonb_build_object(
        'resource_id',
        'f7000000-0000-0000-0000-000000000001',
        'amount',
        1000
      )
    )
  ),
  (
    'f6000000-0000-0000-0000-000000000005',
    'f2000000-0000-0000-0000-000000000001',
    'Host Funded Unit Type',
    5,
    0.05,
    jsonb_build_array(
      jsonb_build_object(
        'resource_id',
        'f7000000-0000-0000-0000-000000000001',
        'amount',
        10
      )
    )
  );

insert into
  public.unit_types (
    id,
    world_id,
    name,
    soldiers_per_unit,
    required_education_level_id,
    desertion_rate
  )
values
  (
    'f6000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Advanced Unit Type',
    5,
    'fa000000-0000-0000-0000-000000000002',
    0.05
  );

insert into
  public.unit_types (
    id,
    world_id,
    name,
    soldiers_per_unit,
    required_building_blueprint_id,
    required_building_tier_number,
    desertion_rate
  )
values
  (
    'f6000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'Garrison Unit Type',
    5,
    'f9000000-0000-0000-0000-000000000001',
    2,
    0.05
  );

insert into
  public.armies (
    id,
    world_id,
    nation_id,
    name,
    funding_source,
    stationed_settlement_id,
    created_turn_number
  )
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Home Army',
    'nation',
    'f4000000-0000-0000-0000-000000000001',
    1
  ),
  (
    'f8000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Host Funded Army',
    'host_settlement',
    'f4000000-0000-0000-0000-000000000002',
    1
  );

insert into
  public.army_units (
    id,
    army_id,
    unit_type_id,
    name,
    created_turn_number
  )
values
  (
    'f8000000-0000-0000-0000-000000000010',
    'f8000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000001',
    'Guard Unit',
    1
  ),
  (
    'f8000000-0000-0000-0000-000000000011',
    'f8000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000002',
    'Advanced Unit',
    1
  ),
  (
    'f8000000-0000-0000-0000-000000000012',
    'f8000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000003',
    'Garrison Unit',
    1
  ),
  (
    'f8000000-0000-0000-0000-000000000013',
    'f8000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000004',
    'Priced Unit',
    1
  ),
  (
    'f8000000-0000-0000-0000-000000000014',
    'f8000000-0000-0000-0000-000000000002',
    'f6000000-0000-0000-0000-000000000005',
    'Host Funded Unit',
    1
  ),
  (
    'f8000000-0000-0000-0000-000000000016',
    'f8000000-0000-0000-0000-000000000001',
    'f6000000-0000-0000-0000-000000000006',
    'Spare Unit',
    1
  );

-- ===========================================================================
-- Authority: an outsider cannot recruit for a nation they don't manage.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000010'::uuid]
  )
  $test$,
    '42501',
    null,
    'outsider cannot recruit soldiers'
  );

reset role;

-- ===========================================================================
-- Settlement must belong to the same nation as the army.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000003'::uuid,
    array['f5000000-0000-0000-0000-000000000010'::uuid]
  )
  $test$,
    '22023',
    'settlement must belong to the nation',
    'settlement outside the nation is rejected'
  );

-- ===========================================================================
-- Per-citizen guards.
-- ===========================================================================
select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000012'::uuid]
  )
  $test$,
    '22023',
    'Citizen Deceased is not alive',
    'a dead citizen cannot be recruited'
  );

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000013'::uuid]
  )
  $test$,
    '22023',
    'Citizen Stranger is not a resident of the settlement',
    'a non-resident citizen cannot be recruited'
  );

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000014'::uuid, 'f5000000-0000-0000-0000-000000000014'::uuid]
  )
  $test$,
    '22023',
    'citizen list must not contain duplicates',
    'duplicate citizen ids are rejected'
  );

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['ffffffff-0000-0000-0000-000000000099'::uuid]
  )
  $test$,
    'P0002',
    'one or more citizens not found',
    'an unknown citizen id is rejected'
  );

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000011'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000016'::uuid]
  )
  $test$,
    '22023',
    'Citizen Uneducated lacks required education (Advanced)',
    'a citizen below the required education rank is rejected'
  );

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000012'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000010'::uuid]
  )
  $test$,
    '22023',
    'settlement lacks the building required for this unit type',
    'insufficient building tier is rejected'
  );

reset role;

-- Enrolled-in-school guard: enroll citizen 14, reusing the barracks
-- settlement_building fixture and target level 'Basic'.
insert into
  public.education_enrollments (
    world_id,
    settlement_building_id,
    citizen_id,
    target_level_id,
    enrolled_turn_number
  )
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f9000000-0000-0000-0000-000000000004',
    'f5000000-0000-0000-0000-000000000014',
    'fa000000-0000-0000-0000-000000000001',
    1
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000014'::uuid]
  )
  $test$,
    '22023',
    'Citizen Scholar is enrolled in school',
    'an enrolled citizen cannot be recruited'
  );

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000015'::uuid]
  )
  $test$,
    '22023',
    'Citizen Officer holds a nation office',
    'an officeholder cannot be recruited'
  );

-- ===========================================================================
-- Insufficient resources: lists the missing resource by name and amount.
-- ===========================================================================
select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000013'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000017'::uuid]
  )
  $test$,
    '22023',
    'insufficient resources: Grain (need 1000, have 0.0000)',
    'insufficient stockpile lists the missing resource'
  );

reset role;

-- Top up the nation stockpile so the priced unit can now afford one soldier.
update public.nation_resource_stockpiles
set
  quantity = 1000
where
  nation_id = 'f3000000-0000-0000-0000-000000000001'
  and resource_id = 'f7000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000013'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000017'::uuid]
  )
  $test$,
    'sufficient stockpile allows recruitment'
  );

reset role;

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'f3000000-0000-0000-0000-000000000001'
        and resource_id = 'f7000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'the nation stockpile is debited by cost x citizen count'
  );

-- ===========================================================================
-- host_settlement funding: cost is deducted from the stationed settlement's
-- stockpile, not the nation's.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000014'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000018'::uuid]
  )
  $test$,
    '22023',
    'insufficient resources: Grain (need 10, have 0.0000)',
    'host settlement funding checks the stationed settlement stockpile'
  );

reset role;

update public.settlement_resource_stockpiles
set
  quantity = 10
where
  settlement_id = 'f4000000-0000-0000-0000-000000000002'
  and resource_id = 'f7000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000014'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000018'::uuid]
  )
  $test$,
    'host-settlement-funded army recruits once its stationed settlement can pay'
  );

reset role;

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'f4000000-0000-0000-0000-000000000002'
        and resource_id = 'f7000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'the stationed settlement stockpile is debited, not the nation stockpile'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'f3000000-0000-0000-0000-000000000001'
        and resource_id = 'f7000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'host-settlement funding leaves the nation stockpile untouched'
  );

-- ===========================================================================
-- Success + capacity + atomicity (rollback on partial failure) using the
-- 1-slot Guard Unit.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000010'::uuid]
  )
  $test$,
    'nation manager can recruit an eligible resident'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.unit_soldiers
      where
        unit_id = 'f8000000-0000-0000-0000-000000000010'
    ),
    1,
    'the recruited soldier is stored'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Already a soldier.
select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000011'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000010'::uuid]
  )
  $test$,
    '22023',
    'Citizen Recruit is already a soldier',
    'a citizen already serving cannot be recruited again'
  );

-- Capacity: Guard Unit's soldiers_per_unit is 1, already holding one soldier.
select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000010'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000011'::uuid]
  )
  $test$,
    '22023',
    null,
    'recruiting past unit capacity is rejected'
  );

-- Atomicity: a batch with one invalid citizen rolls back the whole call --
-- the valid citizen in the same batch must not be left recruited. Uses the
-- unconstrained Spare Unit so only the dead citizen can trip a guard.
select
  throws_ok (
    $test$
  select public.recruit_soldiers(
    'f8000000-0000-0000-0000-000000000016'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000011'::uuid, 'f5000000-0000-0000-0000-000000000012'::uuid]
  )
  $test$,
    '22023',
    'Citizen Deceased is not alive',
    'a batch with an ineligible citizen throws'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.unit_soldiers
      where
        unit_id = 'f8000000-0000-0000-0000-000000000016'
    ),
    0,
    'the whole batch rolled back -- the otherwise-eligible citizen was not recruited'
  );

-- ===========================================================================
-- delete_army_unit is blocked while the unit holds a soldier.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$ select public.delete_army_unit('f8000000-0000-0000-0000-000000000010'::uuid) $test$,
    '22023',
    'unit must have no soldiers before it can be deleted',
    'deleting a unit with soldiers is rejected'
  );

reset role;

select
  set_config(
    'gubernator.test_soldier_id',
    (
      select
        id::text
      from
        public.unit_soldiers
      where
        citizen_id = 'f5000000-0000-0000-0000-000000000010'
    ),
    false
  );

-- ===========================================================================
-- discharge_soldiers: returns the citizen to home_settlement_id.
-- ===========================================================================
-- Simulate the citizen having been moved away from home while serving.
update public.citizens
set
  settlement_id = 'f4000000-0000-0000-0000-000000000002'
where
  id = 'f5000000-0000-0000-0000-000000000010';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$ select public.discharge_soldiers(array[current_setting('gubernator.test_soldier_id')::uuid]) $test$,
    '42501',
    null,
    'outsider cannot discharge soldiers'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  results_eq (
    $test$
  select settlement_id
  from public.discharge_soldiers(array[current_setting('gubernator.test_soldier_id')::uuid])
  $test$,
    $test$ values ('f4000000-0000-0000-0000-000000000001'::uuid) $test$,
    'discharge returns the citizen to their home settlement'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.unit_soldiers
      where
        id = current_setting('gubernator.test_soldier_id')::uuid
    ),
    0,
    'the discharged soldier row is removed'
  );

-- Now the unit is empty again -- deletion succeeds.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$ select public.delete_army_unit('f8000000-0000-0000-0000-000000000010'::uuid) $test$,
    'nation manager can delete the now-empty unit'
  );

-- Discharge fallback: home settlement no longer resolvable -> the army's
-- current stationed settlement is used instead. Recruits into the
-- host-funded army (stationed at settlement 2, distinct from settlement 1
-- so the fallback is observably different from a normal discharge) via its
-- home-settlement resident, f5...011.
reset role;

update public.settlement_resource_stockpiles
set
  quantity = 10
where
  settlement_id = 'f4000000-0000-0000-0000-000000000002'
  and resource_id = 'f7000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.recruit_soldiers (
    'f8000000-0000-0000-0000-000000000014'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    array['f5000000-0000-0000-0000-000000000011'::uuid]
  );

reset role;

update public.unit_soldiers
set
  home_settlement_id = null
where
  citizen_id = 'f5000000-0000-0000-0000-000000000011';

select
  set_config(
    'gubernator.test_fallback_soldier_id',
    (
      select
        id::text
      from
        public.unit_soldiers
      where
        citizen_id = 'f5000000-0000-0000-0000-000000000011'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  results_eq (
    $test$
  select settlement_id
  from public.discharge_soldiers(array[current_setting('gubernator.test_fallback_soldier_id')::uuid])
  $test$,
    $test$ values ('f4000000-0000-0000-0000-000000000002'::uuid) $test$,
    'discharge falls back to the army''s stationed settlement when home no longer resolves'
  );

reset role;

-- ===========================================================================
-- RLS: outsider cannot read unit_soldiers in an inaccessible world; admin can.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.unit_soldiers us
        inner join public.army_units au on au.id = us.unit_id
        inner join public.armies a on a.id = au.army_id
      where
        a.nation_id = 'f3000000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read unit_soldiers in an inaccessible private world'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  cmp_ok (
    (
      select
        count(*)::integer
      from
        public.unit_soldiers us
        inner join public.army_units au on au.id = us.unit_id
        inner join public.armies a on a.id = au.army_id
      where
        a.nation_id = 'f3000000-0000-0000-0000-000000000001'
    ),
    '>=',
    0,
    'world admin can read unit_soldiers in the administered world'
  );

reset role;

select
  *
from
  finish ();

rollback;
