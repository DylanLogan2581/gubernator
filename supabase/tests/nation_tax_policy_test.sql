-- pgTAP tests for the nation tax policy system (#1375): upsert_nation_tax_policy,
-- delete_nation_tax_policy, demand_tribute, and nation_tax_policies RLS.
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
    'e1000000-0000-0000-0000-000000000001',
    'tax-admin@example.com',
    'x',
    now(),
    '{"username":"tax_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'tax-manager@example.com',
    'x',
    now(),
    '{"username":"tax_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'tax-outsider@example.com',
    'x',
    now(),
    '{"username":"tax_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, archived_at)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Tax World',
    'active',
    null
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Tax Archived World',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, tax_rate)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Tax Nation',
    0.1
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    'Archived Tax Nation',
    0
  ),
  (
    'e3000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000001',
    'Other Tax Nation',
    0
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Tax Nation Settlement'
  ),
  (
    'e4000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000003',
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
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'Tax Manager',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'e3000000-0000-0000-0000-000000000001'
  );

insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Tax Grain',
    'tax-grain',
    1000
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Tax Timber',
    'tax-timber',
    100
  );

-- Seed triggers populate zero-quantity nation/settlement stockpile rows and a
-- default tax policy per nation; set explicit balances for the scenarios.
update public.settlement_resource_stockpiles
set
  quantity = 50
where
  settlement_id = 'e4000000-0000-0000-0000-000000000001'
  and resource_id = 'e6000000-0000-0000-0000-000000000001';

update public.settlement_resource_stockpiles
set
  quantity = 90
where
  settlement_id = 'e4000000-0000-0000-0000-000000000001'
  and resource_id = 'e6000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- Backfill trigger: every nation gets a default percent_production rule.
-- ===========================================================================
select
  is (
    (
      select
        rate
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and settlement_id is null
    ),
    0.1::numeric,
    'nation insert seeds a default tax rule mirroring tax_rate'
  );

-- ===========================================================================
-- upsert_nation_tax_policy: outsider cannot write.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.upsert_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      null,
      'percent_stockpile',
      0.2, 0, null, 0, false
    )
  $test$,
    '42501',
    null,
    'outsider cannot upsert a tax policy'
  );

reset role;

-- ===========================================================================
-- upsert_nation_tax_policy: rate out of range is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.upsert_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      null,
      'percent_production',
      1.5, 0, null, 0, false
    )
  $test$,
    '22023',
    null,
    'a rate above 1 is rejected'
  );

reset role;

-- ===========================================================================
-- upsert_nation_tax_policy: an override for a settlement outside the nation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.upsert_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'e4000000-0000-0000-0000-000000000002'::uuid,
      'percent_production',
      0.2, 0, null, 0, false
    )
  $test$,
    'P0002',
    null,
    'an override for a settlement outside the nation is rejected'
  );

reset role;

-- ===========================================================================
-- upsert_nation_tax_policy: manager updates the default rule; tax_rate syncs.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.upsert_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      null,
      'percent_production',
      0.25, 0, null, 5, false
    )
  $test$,
    'manager can update the default tax rule'
  );

reset role;

select
  is (
    (
      select
        rate
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and settlement_id is null
    ),
    0.25::numeric,
    'default rule rate is updated'
  );

select
  is (
    (
      select
        min_stockpile_floor
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and settlement_id is null
    ),
    5::numeric,
    'default rule minimum stockpile floor is stored'
  );

select
  is (
    (
      select
        tax_rate
      from
        public.nations
      where
        id = 'e3000000-0000-0000-0000-000000000001'
    ),
    0.25::numeric,
    'nations.tax_rate mirrors the default percent-of-production rate'
  );

-- ===========================================================================
-- upsert_nation_tax_policy: create + delete a per-settlement override.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.upsert_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'e4000000-0000-0000-0000-000000000001'::uuid,
      'flat',
      0, 12, null, 0, false
    )
  $test$,
    'manager can create a per-settlement override'
  );

reset role;

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and settlement_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    1,
    'per-settlement override row exists'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.delete_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'e4000000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'manager can delete a per-settlement override'
  );

reset role;

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and settlement_id = 'e4000000-0000-0000-0000-000000000001'
    ),
    0,
    'delete removes the per-settlement override'
  );

-- ===========================================================================
-- upsert_nation_tax_policy: archived worlds are read-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.upsert_nation_tax_policy(
      'e3000000-0000-0000-0000-000000000002'::uuid,
      null,
      'percent_production',
      0.2, 0, null, 0, false
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived worlds reject tax policy writes'
  );

reset role;

-- ===========================================================================
-- RLS: world-access users read policies; outsiders see none.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
    ),
    1,
    'world admin can read the nation default tax rule'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.nation_tax_policies
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
    ),
    0,
    'a user without world access cannot read tax policies'
  );

reset role;

-- ===========================================================================
-- demand_tribute: outsider cannot demand.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.demand_tribute(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      'e4000000-0000-0000-0000-000000000001'::uuid,
      '[{"resource_id":"e6000000-0000-0000-0000-000000000001","quantity":10}]'::jsonb
    )
  $test$,
    '42501',
    null,
    'outsider cannot demand tribute'
  );

reset role;

-- ===========================================================================
-- demand_tribute: partial (within available) then clamped-to-available.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_tribute as
select
  *
from
  public.demand_tribute (
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'e4000000-0000-0000-0000-000000000001'::uuid,
    '[{"resource_id":"e6000000-0000-0000-0000-000000000001","quantity":30},{"resource_id":"e6000000-0000-0000-0000-000000000002","quantity":1000}]'::jsonb
  );

reset role;

select
  is (
    (
      select
        seized_quantity
      from
        t_tribute
      where
        resource_id = 'e6000000-0000-0000-0000-000000000001'
    ),
    30::numeric,
    'tribute within available stock seizes the full requested amount'
  );

select
  is (
    (
      select
        seized_quantity
      from
        t_tribute
      where
        resource_id = 'e6000000-0000-0000-0000-000000000002'
    ),
    90::numeric,
    'tribute over available stock is clamped to what the settlement holds'
  );

select
  is (
    (
      select
        clamped
      from
        t_tribute
      where
        resource_id = 'e6000000-0000-0000-0000-000000000002'
    ),
    true,
    'clamped tribute is reported as clamped'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'e4000000-0000-0000-0000-000000000001'
        and resource_id = 'e6000000-0000-0000-0000-000000000002'
    ),
    0::numeric,
    'settlement stockpile never goes negative under tribute'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'e3000000-0000-0000-0000-000000000001'
        and resource_id = 'e6000000-0000-0000-0000-000000000001'
    ),
    30::numeric,
    'the demanding nation treasury is credited the seized grain'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.notifications
      where
        settlement_id = 'e4000000-0000-0000-0000-000000000001'
        and notification_type = 'nation.tribute_demanded'
    ),
    1,
    'a tribute seizure emits a notification to the settlement manager'
  );

-- ===========================================================================
-- demand_tribute: archived worlds are read-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.demand_tribute(
      'e3000000-0000-0000-0000-000000000002'::uuid,
      'e4000000-0000-0000-0000-000000000099'::uuid,
      '[{"resource_id":"e6000000-0000-0000-0000-000000000099","quantity":10}]'::jsonb
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived worlds reject tribute demands'
  );

reset role;

select
  *
from
  finish ();

rollback;
