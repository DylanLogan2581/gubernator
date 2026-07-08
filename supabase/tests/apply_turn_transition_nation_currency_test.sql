-- pgTAP tests for §C38: apply_turn_transition nation currency persistence
-- (#1094) — writing nation_currency_snapshots, updating
-- nation_currencies.confidence, and inserting currency.default /
-- currency.confidence_collapsing notifications from the engine's
-- nationCurrencySnapshots / nationCurrencyUpdates / notifications payload
-- arrays.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a7-prefixed ranges, unique to this file):
--   a7100000 = users        a7200000 = worlds
--   a7300000 = transitions  a7400000 = nations
--   a7500000 = settlements  a7600000 = resources
--   a7700000 = currencies
begin;

select
  plan (7);

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
    'a7100000-0000-0000-0000-000000000001',
    'attnc-superadmin@example.com',
    'x',
    now(),
    '{"username":"attnc_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a7100000-0000-0000-0000-000000000002',
    'attnc-nationmanager@example.com',
    'x',
    now(),
    '{"username":"attnc_nationmanager"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a7100000-0000-0000-0000-000000000001';

-- World 1 (turn 5): happy path — snapshot, confidence update, both
-- notification types.
-- World 2 (turn 5): cross-world guard.
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'a7200000-0000-0000-0000-000000000001',
    'ATTNC Happy Path World',
    5,
    'private',
    'active'
  ),
  (
    'a7200000-0000-0000-0000-000000000002',
    'ATTNC Cross World Guard World',
    5,
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'a7400000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'ATTNC Nation 1'
  ),
  (
    'a7400000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    'ATTNC Nation 2'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'a7500000-0000-0000-0000-000000000001',
    'a7400000-0000-0000-0000-000000000001',
    'ATTNC Settlement 1'
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
    'a7100000-1000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'a7500000-0000-0000-0000-000000000001',
    'player_character',
    'ATTNC Nation Manager',
    'alive',
    'a7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'a7400000-0000-0000-0000-000000000001'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'a7600000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'ATTNC Grain',
    'attnc-grain'
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
    money_supply,
    reserve_quantity,
    confidence,
    established_turn_number
  )
values
  (
    'a7700000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    'a7400000-0000-0000-0000-000000000001',
    'ATTNC Crown',
    'ATC',
    'resource_backed',
    'a7600000-0000-0000-0000-000000000001',
    1,
    100,
    50,
    0.8,
    1
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'a7300000-0000-0000-0000-000000000001',
    'a7200000-0000-0000-0000-000000000001',
    5,
    6,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- All apply_turn_transition calls run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST SCENARIO 1: happy path — snapshot row, confidence update, and both
-- currency notification types are inserted.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a7200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'nationCurrencySnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'currencyId',
          'a7700000-0000-0000-0000-000000000001',
          'nationId',
          'a7400000-0000-0000-0000-000000000001',
          'moneySupply',
          120,
          'reserveQuantity',
          50,
          'confidence',
          0.2,
          'minted',
          20,
          'burned',
          0
        )
      ),
      'nationCurrencyUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'currencyId',
          'a7700000-0000-0000-0000-000000000001',
          'confidence',
          0.2,
          'isInDefault',
          true
        )
      ),
      'notifications',
      jsonb_build_array(
        jsonb_build_object(
          'notificationType',
          'currency.default',
          'scope',
          'nation',
          'nationId',
          'a7400000-0000-0000-0000-000000000001',
          'messageText',
          'ATTNC Crown has defaulted: money supply exceeds reserves.'
        ),
        jsonb_build_object(
          'notificationType',
          'currency.confidence_collapsing',
          'scope',
          'nation',
          'nationId',
          'a7400000-0000-0000-0000-000000000001',
          'messageText',
          'Confidence in ATTNC Crown is collapsing.'
        )
      )
    ),
    'a7300000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        row (
          money_supply,
          reserve_quantity,
          confidence,
          minted,
          burned,
          turn_number
        )
      from
        public.nation_currency_snapshots
      where
        turn_transition_id = 'a7300000-0000-0000-0000-000000000001'
        and currency_id = 'a7700000-0000-0000-0000-000000000001'
    ),
    row (
      120::numeric,
      50::numeric,
      0.2::numeric,
      20::numeric,
      0::numeric,
      5
    ),
    'happy path: nation_currency_snapshots row written with the expected values'
  );

select
  is (
    (
      select
        nation_id
      from
        public.nation_currency_snapshots
      where
        turn_transition_id = 'a7300000-0000-0000-0000-000000000001'
        and currency_id = 'a7700000-0000-0000-0000-000000000001'
    ),
    'a7400000-0000-0000-0000-000000000001'::uuid,
    'happy path: nation_currency_snapshots row carries the correct nation_id'
  );

select
  is (
    (
      select
        confidence
      from
        public.nation_currencies
      where
        id = 'a7700000-0000-0000-0000-000000000001'
    ),
    0.2::numeric,
    'happy path: nation_currencies.confidence is updated from nationCurrencyUpdates'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        generated_in_transition_id = 'a7300000-0000-0000-0000-000000000001'
        and notification_type = 'currency.default'
        and severity = 'critical'
        and nation_id = 'a7400000-0000-0000-0000-000000000001'
        and recipient_user_id = 'a7100000-0000-0000-0000-000000000002'
    ),
    'happy path: currency.default notification inserted with critical severity for the nation manager'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        generated_in_transition_id = 'a7300000-0000-0000-0000-000000000001'
        and notification_type = 'currency.confidence_collapsing'
        and severity = 'warning'
        and nation_id = 'a7400000-0000-0000-0000-000000000001'
        and recipient_user_id = 'a7100000-0000-0000-0000-000000000002'
    ),
    'happy path: currency.confidence_collapsing notification inserted with warning severity for the nation manager'
  );

select
  is (
    (
      select
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'a7300000-0000-0000-0000-000000000001'
        and notification_type = 'currency.default'
        and recipient_user_id = 'a7100000-0000-0000-0000-000000000002'
    ),
    'ATTNC Crown has defaulted: money supply exceeds reserves.',
    'happy path: currency.default notification carries the engine-provided message text'
  );

reset role;

-- ===========================================================================
-- TEST SCENARIO 2: cross-world guard rejects a currencyId from another world
-- ===========================================================================
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'a7300000-0000-0000-0000-000000000002',
    'a7200000-0000-0000-0000-000000000002',
    5,
    6,
    'a7100000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role service_role;

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'a7200000-0000-0000-0000-000000000002',
      5,
      jsonb_build_object(
        'nationCurrencySnapshots',
        jsonb_build_array(
          jsonb_build_object(
            'currencyId', 'a7700000-0000-0000-0000-000000000001',
            'nationId', 'a7400000-0000-0000-0000-000000000001',
            'moneySupply', 10,
            'reserveQuantity', 10,
            'confidence', 1,
            'minted', 0,
            'burned', 0
          )
        )
      ),
      'a7300000-0000-0000-0000-000000000002'::uuid
    )
    $test$,
    'P0001',
    null,
    'cross-world currencyId in nationCurrencySnapshots is rejected'
  );

reset role;

select
  *
from
  finish ();

rollback;
