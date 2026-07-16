-- pgTAP tests for #1126: internal_apply_turn_transition_nation_economy
-- lock+verify drift check on debits and upsert on credits
-- (20261010000001_nation_stockpile_delta_drift_check_and_upsert.sql).
-- Run with: npx supabase test db
--
-- UUID prefix map (all 1126-prefixed ranges, unique to this file):
--   11261000 = users        11262000 = worlds
--   11263000 = transitions  11264000 = nations
--   11266000 = resources
begin;

select
  plan (4);

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
    '11261000-0000-0000-0000-000000000001',
    'nsd-superadmin@example.com',
    'x',
    now(),
    '{"username":"nsd_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '11261000-0000-0000-0000-000000000001';

-- World 1 (turn 5): drift + atomicity — a debit that exceeds the payer's
--   actual balance rolls back an earlier credit in the same payload too.
-- World 2 (turn 5): missing-row credit — a credit against a (nation,
--   resource) pair with no seeded stockpile row upserts instead of
--   silently dropping.
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    '11262000-0000-0000-0000-000000000001',
    'NSD Drift World',
    5,
    'active'
  ),
  (
    '11262000-0000-0000-0000-000000000002',
    'NSD Missing Row World',
    5,
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '11264000-0000-0000-0000-000000000001',
    '11262000-0000-0000-0000-000000000001',
    'NSD Payer Nation'
  ),
  (
    '11264000-0000-0000-0000-000000000002',
    '11262000-0000-0000-0000-000000000001',
    'NSD Payee Nation'
  ),
  (
    '11264000-0000-0000-0000-000000000003',
    '11262000-0000-0000-0000-000000000002',
    'NSD Missing Row Nation'
  );

-- Resource INSERT triggers seed a zero-quantity nation_resource_stockpiles
-- row for every nation already in the resource's world (unless is_trashed).
insert into
  public.resources (id, world_id, name, slug)
values
  (
    '11266000-0000-0000-0000-000000000001',
    '11262000-0000-0000-0000-000000000001',
    'NSD Grain',
    'nsd-grain'
  );

-- Trashed resource: seed triggers skip it, so no nation_resource_stockpiles
-- row exists for it yet — this is the "missing row" scenario.
insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    '11266000-0000-0000-0000-000000000002',
    '11262000-0000-0000-0000-000000000002',
    'NSD Trashed Timber',
    'nsd-trashed-timber',
    true
  );

-- Give the payer nation an actual balance (3) lower than the debit the
-- payload is about to request (10) — simulates concurrent spend between the
-- engine's snapshot and this apply.
update public.nation_resource_stockpiles
set
  quantity = 3
where
  nation_id = '11264000-0000-0000-0000-000000000001'
  and resource_id = '11266000-0000-0000-0000-000000000001';

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
    '11263000-0000-0000-0000-000000000001',
    '11262000-0000-0000-0000-000000000001',
    5,
    6,
    '11261000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    '11263000-0000-0000-0000-000000000002',
    '11262000-0000-0000-0000-000000000002',
    5,
    6,
    '11261000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- All apply_turn_transition calls run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST SCENARIO 1: a debit exceeding the payer's actual balance raises
-- state_drifted, rolling back the paired credit that ran earlier in the
-- same payload (conservation: applied atomically or not at all).
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      '11262000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'nationStockpileDeltas',
        jsonb_build_array(
          jsonb_build_object(
            'nationId', '11264000-0000-0000-0000-000000000002',
            'resourceId', '11266000-0000-0000-0000-000000000001',
            'delta', 10
          ),
          jsonb_build_object(
            'nationId', '11264000-0000-0000-0000-000000000001',
            'resourceId', '11266000-0000-0000-0000-000000000001',
            'delta', -10
          )
        )
      ),
      '11263000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    null,
    'debit exceeding actual balance raises state_drifted'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = '11264000-0000-0000-0000-000000000001'
        and resource_id = '11266000-0000-0000-0000-000000000001'
    ),
    3::numeric(18, 4),
    'drift: payer balance is unchanged after the aborted transition'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = '11264000-0000-0000-0000-000000000002'
        and resource_id = '11266000-0000-0000-0000-000000000001'
    ),
    0::numeric(18, 4),
    'drift: paired payee credit was rolled back along with the failed debit'
  );

-- ===========================================================================
-- TEST SCENARIO 2: a credit against a (nation, resource) pair with no
-- seeded row upserts instead of silently dropping.
-- ===========================================================================
select
  public.apply_turn_transition (
    '11262000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'nationStockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'nationId',
          '11264000-0000-0000-0000-000000000003',
          'resourceId',
          '11266000-0000-0000-0000-000000000002',
          'delta',
          7
        )
      )
    ),
    '11263000-0000-0000-0000-000000000002'::uuid
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = '11264000-0000-0000-0000-000000000003'
        and resource_id = '11266000-0000-0000-0000-000000000002'
    ),
    7::numeric(18, 4),
    'missing row: credit upserts a new nation_resource_stockpiles row'
  );

reset role;

select
  *
from
  finish ();

rollback;
