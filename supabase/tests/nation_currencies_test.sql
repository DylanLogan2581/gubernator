-- pgTAP tests for public.nation_currencies and public.establish_nation_currency:
-- fiat/resource_backed validation, one-currency-per-nation, authority
-- (manage-nation and bank_governor paths), and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (12);

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
    'c1000000-0000-0000-0000-000000000001',
    'currency-admin@example.com',
    'x',
    now(),
    '{"username":"currency_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'currency-manager@example.com',
    'x',
    now(),
    '{"username":"currency_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'currency-outsider@example.com',
    'x',
    now(),
    '{"username":"currency_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'currency-bank-governor@example.com',
    'x',
    now(),
    '{"username":"currency_bank_governor"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'Currency World',
    'private',
    'active',
    5
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Fiat Nation',
    'republic'
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'Backed Nation',
    'monarchy'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    'Fiat Settlement'
  ),
  (
    'c4000000-0000-0000-0000-000000000002',
    'c3000000-0000-0000-0000-000000000002',
    'Backed Settlement'
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
    'c5000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000001',
    'player_character',
    'Fiat Manager',
    'alive',
    'c1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'c3000000-0000-0000-0000-000000000001'
  ),
  (
    'c5000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000002',
    'player_character',
    'Bank Governor',
    'alive',
    'c1000000-0000-0000-0000-000000000004',
    'none',
    null
  );

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
    'c2000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000002',
    (
      select
        id
      from
        public.office_types
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
        and nation_id is null
        and name = 'bank_governor'
    ),
    'c5000000-0000-0000-0000-000000000002',
    1
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c6000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Gold',
    'gold'
  ),
  (
    'c6000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'Deleted Ore',
    'deleted-ore'
  );

update public.resources
set
  is_trashed = true
where
  id = 'c6000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- Authority: a non-manager, non-bank_governor user cannot establish.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.establish_nation_currency(
      'c3000000-0000-0000-0000-000000000001'::uuid,
      'Republic Dollar',
      'RD',
      'fiat'
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the nation cannot establish a currency'
  );

reset role;

-- ===========================================================================
-- resource_backed validation: missing backing fields is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.establish_nation_currency(
      'c3000000-0000-0000-0000-000000000001'::uuid,
      'Republic Dollar',
      'RD',
      'resource_backed'
    )
  $test$,
    '22023',
    null,
    'resource_backed requires backing resource and ratio'
  );

-- ===========================================================================
-- resource_backed validation: a deleted / foreign-world resource is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.establish_nation_currency(
      'c3000000-0000-0000-0000-000000000001'::uuid,
      'Republic Dollar',
      'RD',
      'resource_backed',
      'c6000000-0000-0000-0000-000000000002'::uuid,
      2
    )
  $test$,
    'P0002',
    null,
    'a deleted backing resource is rejected'
  );

-- ===========================================================================
-- Successful fiat establishment (nation_manager authority path).
-- ===========================================================================
select
  public.establish_nation_currency (
    'c3000000-0000-0000-0000-000000000001'::uuid,
    'Republic Dollar',
    'RD',
    'fiat'
  );

reset role;

select
  is (
    (
      select
        currency_type
      from
        public.nation_currencies
      where
        nation_id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'fiat',
    'fiat currency is created'
  );

select
  is (
    (
      select
        backing_resource_id
      from
        public.nation_currencies
      where
        nation_id = 'c3000000-0000-0000-0000-000000000001'
    ),
    null::uuid,
    'fiat currency has no backing resource'
  );

select
  is (
    (
      select
        established_turn_number
      from
        public.nation_currencies
      where
        nation_id = 'c3000000-0000-0000-0000-000000000001'
    ),
    5,
    'fiat currency records the world current turn number'
  );

-- ===========================================================================
-- Second currency for the same nation is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.establish_nation_currency(
      'c3000000-0000-0000-0000-000000000001'::uuid,
      'Second Dollar',
      'SD',
      'fiat'
    )
  $test$,
    '23505',
    null,
    'a second currency for the same nation is rejected'
  );

reset role;

-- ===========================================================================
-- Successful resource_backed establishment via the bank_governor path.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  public.establish_nation_currency (
    'c3000000-0000-0000-0000-000000000002'::uuid,
    'Gold Standard',
    'GS',
    'resource_backed',
    'c6000000-0000-0000-0000-000000000001'::uuid,
    2
  );

reset role;

select
  is (
    (
      select
        backing_resource_id
      from
        public.nation_currencies
      where
        nation_id = 'c3000000-0000-0000-0000-000000000002'
    ),
    'c6000000-0000-0000-0000-000000000001'::uuid,
    'bank_governor can establish a resource_backed currency with valid backing'
  );

-- ===========================================================================
-- fiat forbids backing fields.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.establish_nation_currency(
      'c3000000-0000-0000-0000-000000000002'::uuid,
      'Should Fail',
      'SF',
      'fiat',
      'c6000000-0000-0000-0000-000000000001'::uuid,
      2
    )
  $test$,
    '22023',
    null,
    'fiat forbids backing resource and ratio'
  );

-- ===========================================================================
-- symbol length: over 5 chars is rejected by the table check constraint.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'c3000000-0000-0000-0000-000000000003',
    'c2000000-0000-0000-0000-000000000001',
    'Symbol Nation',
    'republic'
  );

select
  throws_ok (
    $test$
    select public.establish_nation_currency(
      'c3000000-0000-0000-0000-000000000003'::uuid,
      'Overlong Symbol Coin',
      'TOOLONG',
      'fiat'
    )
  $test$,
    '23514',
    null,
    'a symbol longer than 5 chars is rejected'
  );

reset role;

-- ===========================================================================
-- RLS: SELECT is available to a world member who can see the nation, denied
-- to an outsider with no player_character and no admin role.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currencies
      where
        nation_id = 'c3000000-0000-0000-0000-000000000001'
    ),
    1,
    'a nation manager can select their own nation currency row'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currencies
      where
        nation_id = 'c3000000-0000-0000-0000-000000000001'
    ),
    0,
    'an outsider with no visibility into the nation cannot select its currency row'
  );

reset role;

select
  *
from
  finish ();

rollback;
