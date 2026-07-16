-- pgTAP tests for public.mint_currency, public.burn_currency,
-- public.deposit_reserves, public.redeem_reserves, and the
-- public.nation_currency_ledger table (RLS + append-only auditing).
-- Run with: npx supabase test db
begin;

select
  plan (23);

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
    'd1000000-0000-0000-0000-000000000001',
    'bank-admin@example.com',
    'x',
    now(),
    '{"username":"bank_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'bank-fiat-manager@example.com',
    'x',
    now(),
    '{"username":"bank_fiat_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'bank-outsider@example.com',
    'x',
    now(),
    '{"username":"bank_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000004',
    'bank-governor@example.com',
    'x',
    now(),
    '{"username":"bank_governor_user"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Bank World',
    'active',
    7
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Fiat Nation',
    'republic'
  ),
  (
    'd3000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'Backed Nation',
    'monarchy'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Fiat Settlement'
  ),
  (
    'd4000000-0000-0000-0000-000000000002',
    'd3000000-0000-0000-0000-000000000002',
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
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'player_character',
    'Fiat Manager',
    'alive',
    'd1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'd3000000-0000-0000-0000-000000000001'
  ),
  (
    'd5000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000002',
    'player_character',
    'Bank Governor',
    'alive',
    'd1000000-0000-0000-0000-000000000004',
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
    'd2000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000002',
    (
      select
        id
      from
        public.office_types
      where
        world_id = 'd2000000-0000-0000-0000-000000000001'
        and nation_id is null
        and name = 'bank_governor'
    ),
    'd5000000-0000-0000-0000-000000000002',
    1
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Gold',
    'gold'
  );

insert into
  public.nation_currencies (
    id,
    world_id,
    nation_id,
    name,
    symbol,
    currency_type,
    established_turn_number
  )
values
  (
    'd7000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Republic Dollar',
    'RD',
    'fiat',
    1
  );

insert into
  public.nation_currencies (
    id,
    world_id,
    nation_id,
    name,
    symbol,
    currency_type,
    backing_resource_id,
    backing_ratio,
    established_turn_number
  )
values
  (
    'd7000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000002',
    'Gold Standard',
    'GS',
    'resource_backed',
    'd6000000-0000-0000-0000-000000000001',
    2,
    1
  );

update public.nation_resource_stockpiles
set
  quantity = 100
where
  nation_id = 'd3000000-0000-0000-0000-000000000002'
  and resource_id = 'd6000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- Authority: an outsider with no authority over the nation cannot mint.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.mint_currency('d7000000-0000-0000-0000-000000000001'::uuid, 100)
  $test$,
    '42501',
    null,
    'an outsider cannot mint currency'
  );

reset role;

-- ===========================================================================
-- fiat mint is unlimited (nation_manager authority path).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.mint_currency (
    'd7000000-0000-0000-0000-000000000001'::uuid,
    1000
  );

reset role;

select
  is (
    (
      select
        money_supply
      from
        public.nation_currencies
      where
        id = 'd7000000-0000-0000-0000-000000000001'
    ),
    1000::numeric,
    'fiat mint is unlimited and credits money_supply'
  );

select
  is (
    (
      select
        treasury_currency
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-000000000001'
    ),
    1000::numeric,
    'fiat mint credits nations.treasury_currency'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currency_ledger
      where
        currency_id = 'd7000000-0000-0000-0000-000000000001'
        and action = 'mint'
    ),
    1,
    'the fiat mint appends a ledger row'
  );

-- ===========================================================================
-- resource_backed mint is rejected when reserves are zero (cap = 0 * ratio).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.mint_currency('d7000000-0000-0000-0000-000000000002'::uuid, 10)
  $test$,
    '22023',
    'Insufficient reserves',
    'minting with no reserve headroom is rejected'
  );

-- ===========================================================================
-- deposit_reserves moves the backing resource from the nation stockpile into
-- reserve_quantity (bank_governor authority path).
-- ===========================================================================
select
  public.deposit_reserves ('d7000000-0000-0000-0000-000000000002'::uuid, 50);

reset role;

select
  is (
    (
      select
        reserve_quantity
      from
        public.nation_currencies
      where
        id = 'd7000000-0000-0000-0000-000000000002'
    ),
    50::numeric,
    'deposit_reserves credits reserve_quantity'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000002'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    50::numeric,
    'deposit_reserves debits the nation resource stockpile'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currency_ledger
      where
        currency_id = 'd7000000-0000-0000-0000-000000000002'
        and action = 'deposit'
    ),
    1,
    'the deposit appends a ledger row'
  );

-- ===========================================================================
-- resource_backed mint within reserve headroom now succeeds (cap = 50 * 2 =
-- 100), then a further mint that would exceed the cap is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  public.mint_currency ('d7000000-0000-0000-0000-000000000002'::uuid, 80);

reset role;

select
  is (
    (
      select
        money_supply
      from
        public.nation_currencies
      where
        id = 'd7000000-0000-0000-0000-000000000002'
    ),
    80::numeric,
    'resource_backed mint within reserve headroom succeeds'
  );

select
  is (
    (
      select
        treasury_currency
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-000000000002'
    ),
    80::numeric,
    'resource_backed mint credits nations.treasury_currency'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.mint_currency('d7000000-0000-0000-0000-000000000002'::uuid, 30)
  $test$,
    '22023',
    'Insufficient reserves',
    'minting past the reserve cap is rejected'
  );

-- ===========================================================================
-- burn_currency is bound by what the treasury actually holds.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.burn_currency('d7000000-0000-0000-0000-000000000002'::uuid, 1000)
  $test$,
    '22023',
    null,
    'burning more than the treasury holds is rejected'
  );

select
  public.burn_currency ('d7000000-0000-0000-0000-000000000002'::uuid, 30);

reset role;

select
  is (
    (
      select
        money_supply
      from
        public.nation_currencies
      where
        id = 'd7000000-0000-0000-0000-000000000002'
    ),
    50::numeric,
    'burn_currency reduces money_supply'
  );

select
  is (
    (
      select
        treasury_currency
      from
        public.nations
      where
        id = 'd3000000-0000-0000-0000-000000000002'
    ),
    50::numeric,
    'burn_currency debits nations.treasury_currency'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currency_ledger
      where
        currency_id = 'd7000000-0000-0000-0000-000000000002'
        and action = 'burn'
    ),
    1,
    'the burn appends a ledger row'
  );

-- ===========================================================================
-- redeem_reserves is rejected when it would push money_supply above the new
-- reserve capacity (reserve 50, money_supply 50, ratio 2 -> redeeming 30
-- leaves cap 40 < 50), and succeeds within the guard (redeeming 20 leaves cap
-- 60 >= 50).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.redeem_reserves('d7000000-0000-0000-0000-000000000002'::uuid, 30)
  $test$,
    '22023',
    'Would break backing — burn currency first',
    'redeeming past the backing guard is rejected'
  );

select
  public.redeem_reserves ('d7000000-0000-0000-0000-000000000002'::uuid, 20);

reset role;

select
  is (
    (
      select
        reserve_quantity
      from
        public.nation_currencies
      where
        id = 'd7000000-0000-0000-0000-000000000002'
    ),
    30::numeric,
    'redeem_reserves debits reserve_quantity'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000002'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    70::numeric,
    'redeem_reserves credits the nation resource stockpile'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currency_ledger
      where
        currency_id = 'd7000000-0000-0000-0000-000000000002'
        and action = 'redeem'
    ),
    1,
    'the redeem appends a ledger row'
  );

-- ===========================================================================
-- deposit_reserves / redeem_reserves are resource_backed only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.deposit_reserves('d7000000-0000-0000-0000-000000000001'::uuid, 10)
  $test$,
    '22023',
    'deposit_reserves is only available for resource_backed currencies',
    'deposit_reserves rejects a fiat currency'
  );

select
  throws_ok (
    $test$
    select public.redeem_reserves('d7000000-0000-0000-0000-000000000001'::uuid, 10)
  $test$,
    '22023',
    'redeem_reserves is only available for resource_backed currencies',
    'redeem_reserves rejects a fiat currency'
  );

reset role;

-- ===========================================================================
-- RLS: SELECT is available to a world member who can see the nation, denied
-- to an outsider with no player_character and no admin role.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currency_ledger
      where
        currency_id = 'd7000000-0000-0000-0000-000000000002'
    ),
    4,
    'the bank_governor can select the ledger rows for their own nation currency'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_currency_ledger
      where
        currency_id = 'd7000000-0000-0000-0000-000000000002'
    ),
    0,
    'an outsider with no visibility into the nation cannot select its ledger rows'
  );

reset role;

select
  *
from
  finish ();

rollback;
