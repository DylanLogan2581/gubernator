-- pgTAP tests for public.appoint_settlement_office and
-- public.dismiss_settlement_office (#1115): authority guards (settlement
-- manager, nation manager, world admin all qualify; outsiders do not),
-- settlement-residency validation (narrower than nation-office nation
-- membership), scope enforcement against office_types, alive/uniqueness
-- checks, auto-prune on death/moving settlement, RLS, and a regression
-- check that nation offices are unaffected.
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
    'c6000000-0000-0000-0000-000000000001',
    'settlement-offices-admin@example.com',
    'x',
    now(),
    '{"username":"settlement_offices_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c6000000-0000-0000-0000-000000000002',
    'settlement-offices-nation-manager@example.com',
    'x',
    now(),
    '{"username":"settlement_offices_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'c6000000-0000-0000-0000-000000000003',
    'settlement-offices-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"settlement_offices_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'c6000000-0000-0000-0000-000000000004',
    'settlement-offices-outsider@example.com',
    'x',
    now(),
    '{"username":"settlement_offices_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'c7000000-0000-0000-0000-000000000001',
    'Settlement Offices World',
    'active',
    4
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c7000000-0000-0000-0000-000000000001',
    'c6000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'c8000000-0000-0000-0000-000000000001',
    'c7000000-0000-0000-0000-000000000001',
    'Home Nation',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c9000000-0000-0000-0000-000000000001',
    'c8000000-0000-0000-0000-000000000001',
    'Home Settlement'
  ),
  (
    'c9000000-0000-0000-0000-000000000002',
    'c8000000-0000-0000-0000-000000000001',
    'Other Settlement'
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
    role_nation_id,
    role_settlement_id,
    death_cause_category
  )
values
  (
    'ca000000-0000-0000-0000-000000000001',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'player_character',
    'NationManager',
    'alive',
    'c6000000-0000-0000-0000-000000000002',
    'nation_manager',
    'c8000000-0000-0000-0000-000000000001',
    null,
    null
  ),
  (
    'ca000000-0000-0000-0000-000000000002',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'player_character',
    'SettlementManager',
    'alive',
    'c6000000-0000-0000-0000-000000000003',
    'settlement_manager',
    null,
    'c9000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'ca000000-0000-0000-0000-000000000003',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'npc',
    'Mayor Candidate',
    'alive',
    null,
    'none',
    null,
    null,
    null
  ),
  (
    'ca000000-0000-0000-0000-000000000004',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000002',
    'npc',
    'Other Settlement Resident',
    'alive',
    null,
    'none',
    null,
    null,
    null
  ),
  (
    'ca000000-0000-0000-0000-000000000005',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'npc',
    'Dead Resident',
    'dead',
    null,
    'none',
    null,
    null,
    'unknown'
  ),
  (
    'ca000000-0000-0000-0000-000000000006',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'npc',
    'Sheriff Candidate',
    'alive',
    null,
    'none',
    null,
    null,
    null
  );

-- A custom settlement office type owned by the nation, plus a nation-scoped
-- one -- used below to prove appoint_settlement_office only resolves
-- scope = 'settlement' types.
insert into
  public.office_types (
    id,
    world_id,
    nation_id,
    name,
    scope,
    excludes_from_labor
  )
values
  (
    'cb000000-0000-0000-0000-000000000001',
    'c7000000-0000-0000-0000-000000000001',
    'c8000000-0000-0000-0000-000000000001',
    'mayor',
    'settlement',
    true
  ),
  (
    'cb000000-0000-0000-0000-000000000002',
    'c7000000-0000-0000-0000-000000000001',
    'c8000000-0000-0000-0000-000000000001',
    'sheriff',
    'settlement',
    true
  );

-- ===========================================================================
-- Authority: a user with no authority over the settlement cannot appoint.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_settlement_office(
      'c9000000-0000-0000-0000-000000000001'::uuid,
      'mayor',
      'ca000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the settlement cannot appoint an office'
  );

reset role;

-- ===========================================================================
-- Scope enforcement: a nation-scoped office type name (e.g. 'senator', a
-- world default) cannot be resolved by appoint_settlement_office.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_settlement_office(
      'c9000000-0000-0000-0000-000000000001'::uuid,
      'senator',
      'ca000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '22023',
    null,
    'a nation-scoped office type name is not resolvable by appoint_settlement_office'
  );

-- ===========================================================================
-- Residency: a citizen resident of a different settlement (same nation) is
-- rejected -- narrower than the nation-office nation-membership rule.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.appoint_settlement_office(
      'c9000000-0000-0000-0000-000000000001'::uuid,
      'mayor',
      'ca000000-0000-0000-0000-000000000004'::uuid
    )
  $test$,
    '22023',
    null,
    'a citizen resident of a different settlement is rejected'
  );

-- ===========================================================================
-- Dead citizen rejection.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.appoint_settlement_office(
      'c9000000-0000-0000-0000-000000000001'::uuid,
      'mayor',
      'ca000000-0000-0000-0000-000000000005'::uuid
    )
  $test$,
    '22023',
    null,
    'a dead citizen is rejected'
  );

-- ===========================================================================
-- Successful appointment by the settlement manager records the world's
-- current turn number.
-- ===========================================================================
select
  public.appoint_settlement_office (
    'c9000000-0000-0000-0000-000000000001'::uuid,
    'mayor',
    'ca000000-0000-0000-0000-000000000003'::uuid
  );

reset role;

select
  is (
    (
      select
        appointed_turn_number
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
        and citizen_id = 'ca000000-0000-0000-0000-000000000003'
        and office_type_id = 'cb000000-0000-0000-0000-000000000001'
    ),
    4,
    'appointing a settlement office records the world current turn number'
  );

-- ===========================================================================
-- The settlement's nation manager can also appoint (authority path 2).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.appoint_settlement_office (
    'c9000000-0000-0000-0000-000000000001'::uuid,
    'sheriff',
    'ca000000-0000-0000-0000-000000000006'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
    ),
    2,
    'the settlement''s nation manager can also appoint a settlement office'
  );

-- ===========================================================================
-- RLS: SELECT is available to world members, denied to outsiders.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
    ),
    2,
    'a world member can select settlement-scoped nation_offices rows'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no world access cannot select settlement-scoped nation_offices rows'
  );

reset role;

-- ===========================================================================
-- Uniqueness: the same citizen cannot hold the same settlement office twice.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.appoint_settlement_office(
      'c9000000-0000-0000-0000-000000000001'::uuid,
      'mayor',
      'ca000000-0000-0000-0000-000000000003'::uuid
    )
  $test$,
    '23505',
    null,
    'a citizen cannot hold the same settlement office twice'
  );

-- ===========================================================================
-- #1150: max_holders boundary -- one appointee reaches the cap, the next is
-- rejected (mirrors the nation-office max_holders coverage in
-- office_types_test.sql; the settlement variant had none).
-- ===========================================================================
reset role;

insert into
  public.office_types (id, world_id, nation_id, name, scope, max_holders)
values
  (
    'cb000000-0000-0000-0000-000000000003',
    'c7000000-0000-0000-0000-000000000001',
    'c8000000-0000-0000-0000-000000000001',
    'constable',
    'settlement',
    1
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
    role_nation_id,
    role_settlement_id,
    death_cause_category
  )
values
  (
    'ca000000-0000-0000-0000-000000000007',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'npc',
    'Constable Candidate One',
    'alive',
    null,
    'none',
    null,
    null,
    null
  ),
  (
    'ca000000-0000-0000-0000-000000000008',
    'c7000000-0000-0000-0000-000000000001',
    'c9000000-0000-0000-0000-000000000001',
    'npc',
    'Constable Candidate Two',
    'alive',
    null,
    'none',
    null,
    null,
    null
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.appoint_settlement_office (
    'c9000000-0000-0000-0000-000000000001'::uuid,
    'constable',
    'ca000000-0000-0000-0000-000000000007'::uuid
  );

select
  throws_ok (
    $test$
    select public.appoint_settlement_office(
      'c9000000-0000-0000-0000-000000000001'::uuid,
      'constable',
      'ca000000-0000-0000-0000-000000000008'::uuid
    )
  $test$,
    '22023',
    null,
    'max_holders boundary: appointing beyond the cap is rejected'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
        and office_type_id = 'cb000000-0000-0000-0000-000000000003'
    ),
    1,
    'max_holders boundary: exactly one holder reaches the cap, no more'
  );

-- ===========================================================================
-- dismiss_settlement_office: authority guard, then removes the row.
-- ===========================================================================
select
  set_config(
    'gubernator.test_mayor_office_id',
    (
      select
        id::text
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
        and citizen_id = 'ca000000-0000-0000-0000-000000000003'
        and office_type_id = 'cb000000-0000-0000-0000-000000000001'
    ),
    false
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.dismiss_settlement_office(
      current_setting('gubernator.test_mayor_office_id')::uuid
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the settlement cannot dismiss an office'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  public.dismiss_settlement_office (
    current_setting('gubernator.test_mayor_office_id')::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
        and citizen_id = 'ca000000-0000-0000-0000-000000000003'
    ),
    0,
    'dismiss_settlement_office removes the office row'
  );

-- ===========================================================================
-- Auto-prune: office is removed when the citizen moves to a different
-- settlement (residency-scoped, unlike nation offices which only require
-- staying somewhere in the nation).
-- ===========================================================================
update public.citizens
set
  settlement_id = 'c9000000-0000-0000-0000-000000000002'
where
  id = 'ca000000-0000-0000-0000-000000000006';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        settlement_id = 'c9000000-0000-0000-0000-000000000001'
        and citizen_id = 'ca000000-0000-0000-0000-000000000006'
    ),
    0,
    'moving to a different settlement auto-prunes the settlement office'
  );

-- ===========================================================================
-- Regression: office_types RLS still restricts custom settlement office
-- type creation to the nation manager/admin -- a plain settlement manager
-- cannot invent one (#1115 requirement: "creatable by the settlement's
-- nation manager or admin").
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.office_types (world_id, nation_id, name, scope, excludes_from_labor)
    values (
      'c7000000-0000-0000-0000-000000000001',
      'c8000000-0000-0000-0000-000000000001',
      'guildmaster',
      'settlement',
      true
    )
  $test$,
    '42501',
    null,
    'a plain settlement manager cannot create a custom settlement office type'
  );

reset role;

select
  *
from
  finish ();

rollback;
