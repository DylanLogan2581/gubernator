-- pgTAP tests for §C37: apply_turn_transition nation economy persistence
-- (#1083) — crediting nation_resource_stockpiles and writing
-- nation_turn_snapshots from the engine's nationStockpileDeltas /
-- nationTurnSnapshots payload arrays.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a6-prefixed ranges, unique to this file):
--   a6100000 = users        a6200000 = worlds
--   a6300000 = transitions  a6400000 = nations
--   a6500000 = settlements  a6600000 = resources
begin;

select
  plan (6);

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
    'a6100000-0000-0000-0000-000000000001',
    'attne-superadmin@example.com',
    'x',
    now(),
    '{"username":"attne_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a6100000-0000-0000-0000-000000000001';

-- World 1 (turn 5): credit + snapshot happy path.
-- World 2 (turn 8): idempotency — a snapshot row already exists for the
--   running transition (simulates a partial-run retry).
-- World 3 (turn 5): cross-world guard.
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'a6200000-0000-0000-0000-000000000001',
    'ATTNE Happy Path World',
    5,
    'active'
  ),
  (
    'a6200000-0000-0000-0000-000000000002',
    'ATTNE Idempotency World',
    8,
    'active'
  ),
  (
    'a6200000-0000-0000-0000-000000000003',
    'ATTNE Cross World Guard World',
    5,
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'a6400000-0000-0000-0000-000000000001',
    'a6200000-0000-0000-0000-000000000001',
    'ATTNE Nation 1'
  ),
  (
    'a6400000-0000-0000-0000-000000000002',
    'a6200000-0000-0000-0000-000000000002',
    'ATTNE Nation 2'
  ),
  (
    'a6400000-0000-0000-0000-000000000003',
    'a6200000-0000-0000-0000-000000000003',
    'ATTNE Nation 3'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'a6500000-0000-0000-0000-000000000001',
    'a6400000-0000-0000-0000-000000000001',
    'ATTNE Settlement 1'
  ),
  (
    'a6500000-0000-0000-0000-000000000002',
    'a6400000-0000-0000-0000-000000000002',
    'ATTNE Settlement 2'
  );

-- Resource INSERT triggers seed a zero-quantity nation_resource_stockpiles
-- row for every nation already in the resource's world.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'a6600000-0000-0000-0000-000000000001',
    'a6200000-0000-0000-0000-000000000001',
    'ATTNE Grain',
    'attne-grain'
  ),
  (
    'a6600000-0000-0000-0000-000000000002',
    'a6200000-0000-0000-0000-000000000002',
    'ATTNE Timber',
    'attne-timber'
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
    'a6300000-0000-0000-0000-000000000001',
    'a6200000-0000-0000-0000-000000000001',
    5,
    6,
    'a6100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'a6300000-0000-0000-0000-000000000002',
    'a6200000-0000-0000-0000-000000000002',
    8,
    9,
    'a6100000-0000-0000-0000-000000000001',
    'running'
  );

-- Pre-seeded snapshot for the idempotency test — simulates a partial run
-- that already wrote this row; ON CONFLICT DO NOTHING should suppress the
-- duplicate on retry.
insert into
  public.nation_turn_snapshots (
    turn_transition_id,
    world_id,
    nation_id,
    turn_number,
    tax_collected_by_resource_json
  )
values
  (
    'a6300000-0000-0000-0000-000000000002',
    'a6200000-0000-0000-0000-000000000002',
    'a6400000-0000-0000-0000-000000000002',
    8,
    jsonb_build_object('a6600000-0000-0000-0000-000000000002', 3)
  );

-- ===========================================================================
-- All apply_turn_transition calls run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST SCENARIO 1: credits nation_resource_stockpiles and writes a snapshot
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'nationStockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'nationId',
          'a6400000-0000-0000-0000-000000000001',
          'resourceId',
          'a6600000-0000-0000-0000-000000000001',
          'delta',
          10
        )
      ),
      'nationTurnSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'nationId',
          'a6400000-0000-0000-0000-000000000001',
          'taxCollectedByResource',
          jsonb_build_object('a6600000-0000-0000-0000-000000000001', 10)
        )
      )
    ),
    'a6300000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'a6400000-0000-0000-0000-000000000001'
        and resource_id = 'a6600000-0000-0000-0000-000000000001'
    ),
    10::numeric(18, 4),
    'happy path: nation_resource_stockpiles credited by the delta'
  );

select
  is (
    (
      select
        tax_collected_by_resource_json
      from
        public.nation_turn_snapshots
      where
        turn_transition_id = 'a6300000-0000-0000-0000-000000000001'
        and nation_id = 'a6400000-0000-0000-0000-000000000001'
    ),
    jsonb_build_object('a6600000-0000-0000-0000-000000000001', 10),
    'happy path: nation_turn_snapshots row written with the tax breakdown'
  );

select
  is (
    (
      select
        turn_number
      from
        public.nation_turn_snapshots
      where
        turn_transition_id = 'a6300000-0000-0000-0000-000000000001'
        and nation_id = 'a6400000-0000-0000-0000-000000000001'
    ),
    5,
    'happy path: nation_turn_snapshots.turn_number is the expected (pre-advance) turn'
  );

-- ===========================================================================
-- TEST SCENARIO 2: idempotency — ON CONFLICT DO NOTHING suppresses the
-- duplicate snapshot row on retry, while the stockpile credit still applies.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000002',
    8,
    jsonb_build_object(
      'nationStockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'nationId',
          'a6400000-0000-0000-0000-000000000002',
          'resourceId',
          'a6600000-0000-0000-0000-000000000002',
          'delta',
          4
        )
      ),
      'nationTurnSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'nationId',
          'a6400000-0000-0000-0000-000000000002',
          'taxCollectedByResource',
          jsonb_build_object('a6600000-0000-0000-0000-000000000002', 4)
        )
      )
    ),
    'a6300000-0000-0000-0000-000000000002'::uuid
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_turn_snapshots
      where
        turn_transition_id = 'a6300000-0000-0000-0000-000000000002'
        and nation_id = 'a6400000-0000-0000-0000-000000000002'
    ),
    1,
    'idempotency: retry does not duplicate the pre-existing snapshot row'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'a6400000-0000-0000-0000-000000000002'
        and resource_id = 'a6600000-0000-0000-0000-000000000002'
    ),
    4::numeric(18, 4),
    'idempotency: stockpile credit still applies on retry'
  );

reset role;

-- ===========================================================================
-- TEST SCENARIO 3: cross-world guard rejects a nationId from another world
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
    'a6300000-0000-0000-0000-000000000003',
    'a6200000-0000-0000-0000-000000000003',
    5,
    6,
    'a6100000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role service_role;

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'a6200000-0000-0000-0000-000000000003',
      5,
      jsonb_build_object(
        'nationStockpileDeltas',
        jsonb_build_array(
          jsonb_build_object(
            'nationId', 'a6400000-0000-0000-0000-000000000001',
            'resourceId', 'a6600000-0000-0000-0000-000000000001',
            'delta', 5
          )
        )
      ),
      'a6300000-0000-0000-0000-000000000003'::uuid
    )
    $test$,
    'P0001',
    null,
    'cross-world nationId in nationStockpileDeltas is rejected'
  );

reset role;

select
  *
from
  finish ();

rollback;
