-- pgTAP end-to-end suite for public.apply_turn_transition().
-- Exercises the full RPC with a rich seeded fixture to lock in invariants
-- that per-patch tests (§C28–§C35) cannot easily express together.
-- Run with: npx supabase test db
--
-- Coverage matrix:
-- ┌─────────────────────────────────────────┬────────────────────┬───────┐
-- │ Scenario                                │ Expected outcome   │ Tests │
-- ├─────────────────────────────────────────┼────────────────────┼───────┤
-- │ Auth: nation manager                    │ 42501              │ 1     │
-- │ Auth: settlement manager                │ 42501              │ 1     │
-- │ Auth: outsider (no world access)        │ 42501              │ 1     │
-- │ Auth: anon role (no EXECUTE grant)      │ 42501              │ 1     │
-- │ Auth: archived world                    │ P0001              │ 1     │
-- │ Auth: stale expected turn               │ P0001              │ 1     │
-- │ Auth: super admin — full payload        │ success            │ 1     │
-- │ Auth: world admin — empty payload       │ success            │ 1     │
-- │ patchCounts reflect payload shape       │ exact match        │ 9     │
-- │ Wholeness: resource snapshot rows = 2   │ count match        │ 1     │
-- │ Wholeness: settlement snapshot rows = 2 │ count match        │ 1     │
-- │ Wholeness: log entry rows = 1           │ count match        │ 1     │
-- │ Snapshot completeness: settlement_1     │ row exists         │ 1     │
-- │ Snapshot completeness: settlement_2     │ row exists         │ 1     │
-- │ Snapshot completeness: s1/r1 resource   │ row exists         │ 1     │
-- │ Snapshot completeness: s2/r1 resource   │ row exists         │ 1     │
-- │ World advance: turn +1 after call       │ exact value        │ 1     │
-- │ World advance: turn +1 after retry      │ idempotent         │ 1     │
-- │ Citizen death applied                   │ status = dead      │ 1     │
-- │ Partnership widowed                     │ status = widowed   │ 1     │
-- │ Trade route paused                      │ status = paused    │ 1     │
-- │ Assignment clear applied                │ row deleted        │ 1     │
-- │ Born-on-turn backfill applied           │ column updated     │ 1     │
-- │ Post-advance stale turn guard           │ P0001              │ 1     │
-- │ Idempotency: settlement snapshots       │ no double-write    │ 1     │
-- │ Idempotency: resource snapshots         │ no double-write    │ 1     │
-- └─────────────────────────────────────────┴────────────────────┴───────┘
--
-- UUID prefix map (all d6-prefixed ranges, unique to this file):
--   d6100000 = users          d6200000 = worlds
--   d6300000 = nations        d6400000 = settlements
--   d6500000 = citizens       d6600000 = resources
--   d6700000 = partnerships   d6800000 = trade_routes
begin;

select
  plan (34);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   d6100000-0001 = super admin (world owner for all worlds)
--   d6100000-0002 = explicit world admin for World 1
--   d6100000-0003 = nation manager PC (NOT a world admin)
--   d6100000-0004 = settlement manager PC (NOT a world admin)
--   d6100000-0005 = outsider (no world access)
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
    'd6100000-0000-0000-0000-000000000001',
    'attfe-superadmin@example.com',
    'x',
    now(),
    '{"username":"attfe_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd6100000-0000-0000-0000-000000000002',
    'attfe-wadmin@example.com',
    'x',
    now(),
    '{"username":"attfe_wadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd6100000-0000-0000-0000-000000000003',
    'attfe-natmgr@example.com',
    'x',
    now(),
    '{"username":"attfe_natmgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'd6100000-0000-0000-0000-000000000004',
    'attfe-setmgr@example.com',
    'x',
    now(),
    '{"username":"attfe_setmgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'd6100000-0000-0000-0000-000000000005',
    'attfe-outsider@example.com',
    'x',
    now(),
    '{"username":"attfe_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd6100000-0000-0000-0000-000000000001';

-- Worlds:
--   World 1 (turn 5, active): full-fixture end-to-end world
--   World 2 (turn 2, archived): for P0001 guard test
--   World 3 (turn 7, active): idempotency world
insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status
  )
values
  (
    'd6200000-0000-0000-0000-000000000001',
    'ATTFE Main World',
    'd6100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'd6200000-0000-0000-0000-000000000002',
    'ATTFE Archived World',
    'd6100000-0000-0000-0000-000000000001',
    2,
    'private',
    'active'
  ),
  (
    'd6200000-0000-0000-0000-000000000003',
    'ATTFE Idempotency World',
    'd6100000-0000-0000-0000-000000000001',
    7,
    'private',
    'active'
  );

update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = 'd6200000-0000-0000-0000-000000000002';

-- Explicit world admin for World 1 only
insert into
  public.world_admins (world_id, user_id)
values
  (
    'd6200000-0000-0000-0000-000000000001',
    'd6100000-0000-0000-0000-000000000002'
  );

-- Nations (one per active world)
insert into
  public.nations (id, world_id, name)
values
  (
    'd6300000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    'ATTFE Nation 1'
  ),
  (
    'd6300000-0000-0000-0000-000000000003',
    'd6200000-0000-0000-0000-000000000003',
    'ATTFE Nation 3'
  );

-- Settlements
insert into
  public.settlements (id, nation_id, name)
values
  -- World 1: two settlements for multi-settlement coverage
  (
    'd6400000-0000-0000-0000-000000000001',
    'd6300000-0000-0000-0000-000000000001',
    'ATTFE Settlement 1'
  ),
  (
    'd6400000-0000-0000-0000-000000000002',
    'd6300000-0000-0000-0000-000000000001',
    'ATTFE Settlement 2'
  ),
  -- World 3: one settlement for idempotency test
  (
    'd6400000-0000-0000-0000-000000000003',
    'd6300000-0000-0000-0000-000000000003',
    'ATTFE Settlement 3'
  );

-- Resources (World 1 — base_stockpile_cap large enough to avoid server-side clamping)
insert into
  public.resources (
    id,
    world_id,
    name,
    slug,
    base_stockpile_cap,
    is_system_resource
  )
values
  (
    'd6600000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    'ATTFE Food',
    'attfe_food',
    1000,
    false
  );

-- Resources (World 3 — for idempotency stockpile delta)
insert into
  public.resources (
    id,
    world_id,
    name,
    slug,
    base_stockpile_cap,
    is_system_resource
  )
values
  (
    'd6600000-0000-0000-0000-000000000003',
    'd6200000-0000-0000-0000-000000000003',
    'ATTFE Water',
    'attfe_water',
    1000,
    false
  );

-- Stockpiles: the seed triggers already created zero-quantity rows when
-- resources were inserted above. Update to the desired starting quantities.
update public.settlement_resource_stockpiles
set
  quantity = 100
where
  settlement_id = 'd6400000-0000-0000-0000-000000000001'
  and resource_id = 'd6600000-0000-0000-0000-000000000001';

update public.settlement_resource_stockpiles
set
  quantity = 50
where
  settlement_id = 'd6400000-0000-0000-0000-000000000002'
  and resource_id = 'd6600000-0000-0000-0000-000000000001';

update public.settlement_resource_stockpiles
set
  quantity = 200
where
  settlement_id = 'd6400000-0000-0000-0000-000000000003'
  and resource_id = 'd6600000-0000-0000-0000-000000000003';

-- Citizens:
--   d6500000-0001 = NPC alive → will be killed by citizenDeaths
--   d6500000-0002 = NPC alive, born_on_turn_number null → will be backfilled to 3
--   d6500000-0003 = NPC alive with assignment → assignment will be cleared
--   d6500000-0004 = NPC alive (partner A) → partnership will be widowed
--   d6500000-0005 = NPC alive (partner B) → paired with 0004
--   d6500000-0006 = PC alive, nation_manager role → used for notification fan-out + auth denial
--   d6500000-0007 = PC alive, settlement_manager for Settlement 1 → auth denial + notification
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    death_cause_category
  )
values
  (
    'd6500000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'npc',
    'ATTFE Doomed NPC',
    'alive',
    null
  ),
  (
    'd6500000-0000-0000-0000-000000000002',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'npc',
    'ATTFE Backfill NPC',
    'alive',
    null
  ),
  (
    'd6500000-0000-0000-0000-000000000003',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'npc',
    'ATTFE Assigned NPC',
    'alive',
    null
  ),
  (
    'd6500000-0000-0000-0000-000000000004',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'npc',
    'ATTFE Partner A',
    'alive',
    null
  ),
  (
    'd6500000-0000-0000-0000-000000000005',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'npc',
    'ATTFE Partner B',
    'alive',
    null
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_nation_id,
    death_cause_category
  )
values
  (
    'd6500000-0000-0000-0000-000000000006',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'player_character',
    'ATTFE Nation Manager',
    'alive',
    'd6100000-0000-0000-0000-000000000003',
    'nation_manager',
    'd6300000-0000-0000-0000-000000000001',
    null
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_settlement_id,
    death_cause_category
  )
values
  (
    'd6500000-0000-0000-0000-000000000007',
    'd6200000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'player_character',
    'ATTFE Settlement Manager',
    'alive',
    'd6100000-0000-0000-0000-000000000004',
    'settlement_manager',
    'd6400000-0000-0000-0000-000000000001',
    null
  );

-- Citizen assignment for citizen 003 (will be cleared by assignmentClears).
-- Uses construction_project type with null construction_project_id (pool member)
-- to avoid needing a real job_definition FK.
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    assigned_on_turn_number
  )
values
  (
    'd6500000-0000-0000-0000-000000000003',
    'construction_project',
    4
  );

-- Active partnership between citizens 004 and 005 (will be widowed)
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number
  )
values
  (
    'd6700000-0000-0000-0000-000000000001',
    'd6500000-0000-0000-0000-000000000004',
    'd6500000-0000-0000-0000-000000000005',
    'active',
    3
  );

-- Active trade route from Settlement 1 to Settlement 2 (will be paused)
-- proposed_by_citizen_id uses citizen 001 (NPC in same world)
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status
  )
values
  (
    'd6800000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000001',
    'd6400000-0000-0000-0000-000000000002',
    'd6600000-0000-0000-0000-000000000001',
    10,
    'active',
    'd6500000-0000-0000-0000-000000000001',
    'approved',
    'approved'
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
    'd6300000-0000-0000-0000-000000000001',
    'd6200000-0000-0000-0000-000000000001',
    5,
    6,
    'd6100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'd6300000-0000-0000-0000-000000000002',
    'd6200000-0000-0000-0000-000000000001',
    6,
    7,
    'd6100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'd6300000-0000-0000-0000-000000000003',
    'd6200000-0000-0000-0000-000000000003',
    7,
    8,
    'd6100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- AUTH FAILURE TESTS (World 1 is still at turn 5; failures don't advance it)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Test 1: Nation manager → 42501
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000001',
      5,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    '42501',
    null,
    'nation manager (non-world-admin) gets 42501'
  );

-- ---------------------------------------------------------------------------
-- Test 2: Settlement manager → 42501
-- ---------------------------------------------------------------------------
set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000001',
      5,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    '42501',
    null,
    'settlement manager (non-world-admin) gets 42501'
  );

-- ---------------------------------------------------------------------------
-- Test 3: Outsider → 42501
-- ---------------------------------------------------------------------------
set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000001',
      5,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    '42501',
    null,
    'outsider (no world access) gets 42501'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: Anon role — no EXECUTE grant → 42501
-- ---------------------------------------------------------------------------
set
  local role anon;

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000001',
      5,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    '42501',
    null,
    'anon role cannot execute apply_turn_transition'
  );

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: Archived world → P0001
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000002',
      2,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    'P0001',
    null,
    'archived world raises P0001'
  );

-- ---------------------------------------------------------------------------
-- Test 6: Stale expected turn (World 1 is at 5, caller says 99) → P0001
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000001',
      99,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    'P0001',
    null,
    'stale expected turn number raises P0001'
  );

-- ===========================================================================
-- FULL END-TO-END CALL: super admin, rich payload on World 1 (turn 5 → 6)
-- ===========================================================================
-- Payload covers:
--   stockpileDeltas        (2 entries: s1/r1, s2/r1)
--   bornOnTurnBackfill     (1 entry: citizen 002 → turn 3)
--   citizenDeaths          (1 entry: citizen 001 → starvation)
--   assignmentClears       (1 entry: citizen 003)
--   partnershipChanges     (1 entry: partners 004+005 → widowed)
--   tradeRouteOutcomes     (1 entry: route 001 → paused)
--   logEntries             (1 entry: starvation log)
--   notifications          (1 entry: settlement-scoped → fans out to 4 recipients)
--   settlementSnapshots    (2 entries: s1, s2)
-- ===========================================================================
do $$
declare
  v_result jsonb;
begin
  v_result := public.apply_turn_transition(
    'd6200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'stockpileDeltas', jsonb_build_array(
        jsonb_build_object(
          'settlementId', 'd6400000-0000-0000-0000-000000000001',
          'resourceId',   'd6600000-0000-0000-0000-000000000001',
          'quantityBefore', 100,
          'quantityAfter',  80,
          'produced', 10,
          'consumed', 30,
          'tradeIn',  0,
          'tradeOut', 0
        ),
        jsonb_build_object(
          'settlementId', 'd6400000-0000-0000-0000-000000000002',
          'resourceId',   'd6600000-0000-0000-0000-000000000001',
          'quantityBefore', 50,
          'quantityAfter',  70,
          'produced', 20,
          'consumed', 0,
          'tradeIn',  0,
          'tradeOut', 0
        )
      ),
      'bornOnTurnBackfill', jsonb_build_array(
        jsonb_build_object(
          'citizenId',         'd6500000-0000-0000-0000-000000000002',
          'bornOnTurnNumber',  3
        )
      ),
      'citizenDeaths', jsonb_build_array(
        jsonb_build_object(
          'citizenId',          'd6500000-0000-0000-0000-000000000001',
          'deathCauseCategory', 'starvation',
          'deathCause',         'ran out of food'
        )
      ),
      'assignmentClears', jsonb_build_array(
        jsonb_build_object(
          'citizenId', 'd6500000-0000-0000-0000-000000000003'
        )
      ),
      'partnershipChanges', jsonb_build_array(
        jsonb_build_object(
          'citizenAId',         'd6500000-0000-0000-0000-000000000004',
          'citizenBId',         'd6500000-0000-0000-0000-000000000005',
          'toStatus',           'widowed',
          'endedOnTurnNumber',  5
        )
      ),
      'tradeRouteOutcomes', jsonb_build_array(
        jsonb_build_object(
          'tradeRouteId', 'd6800000-0000-0000-0000-000000000001',
          'toStatus',     'paused',
          'pauseReason',  'insufficient_stock'
        )
      ),
      'logEntries', jsonb_build_array(
        jsonb_build_object(
          'category',     'settlement.starvation_occurred',
          'settlementId', 'd6400000-0000-0000-0000-000000000001',
          'payload',      jsonb_build_object('deaths', 1)
        )
      ),
      'notifications', jsonb_build_array(
        jsonb_build_object(
          'notificationType', 'settlement.starvation_occurred',
          'messageText',      '1 citizen starved in ATTFE Settlement 1.',
          'scope',            'settlement',
          'settlementId',     'd6400000-0000-0000-0000-000000000001'
        )
      ),
      'settlementSnapshots', jsonb_build_array(
        jsonb_build_object(
          'settlementId',           'd6400000-0000-0000-0000-000000000001',
          'turnNumber',             5,
          'aliveTotal',             49,
          'aliveNpc',               48,
          'alivePc',                1,
          'populationCap',          100,
          'birthCount',             0,
          'deathCount',             1,
          'starvationDeathsCount',  1,
          'homelessDeathsCount',    0,
          'partnershipsFormedCount', 0,
          'buildingSummary', jsonb_build_object(
            'active', 0, 'suspended', 0,
            'auto_deconstructed', 0, 'manually_deconstructed', 0
          ),
          'warnings', jsonb_build_object(
            'depletedDepositIds', jsonb_build_array(),
            'pausedProjectIds',   jsonb_build_array()
          )
        ),
        jsonb_build_object(
          'settlementId',           'd6400000-0000-0000-0000-000000000002',
          'turnNumber',             5,
          'aliveTotal',             30,
          'aliveNpc',               30,
          'alivePc',                0,
          'populationCap',          80,
          'birthCount',             0,
          'deathCount',             0,
          'starvationDeathsCount',  0,
          'homelessDeathsCount',    0,
          'partnershipsFormedCount', 0,
          'buildingSummary', jsonb_build_object(
            'active', 0, 'suspended', 0,
            'auto_deconstructed', 0, 'manually_deconstructed', 0
          ),
          'warnings', jsonb_build_object(
            'depletedDepositIds', jsonb_build_array(),
            'pausedProjectIds',   jsonb_build_array()
          )
        )
      )
    ),
    'd6300000-0000-0000-0000-000000000001'::uuid
  );
  -- Stash the result so assertions can access it without re-calling the RPC.
  perform set_config('attfe.last_result', v_result::text, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Test 7: Super admin call succeeded (transitionId is present in result)
-- ---------------------------------------------------------------------------
select
  ok (
    (
      current_setting('attfe.last_result', true)::jsonb ->> 'transitionId'
    ) is not null,
    'super admin full payload call returns a transitionId'
  );

-- ---------------------------------------------------------------------------
-- Tests 8–16: patchCounts reflect payload shape exactly
-- ---------------------------------------------------------------------------
select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'stockpileDeltas'
    )::integer,
    2,
    'patchCounts.stockpileDeltas = 2'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'bornOnTurnBackfill'
    )::integer,
    1,
    'patchCounts.bornOnTurnBackfill = 1'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'citizenDeaths'
    )::integer,
    1,
    'patchCounts.citizenDeaths = 1'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'assignmentClears'
    )::integer,
    1,
    'patchCounts.assignmentClears = 1'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'partnershipChanges'
    )::integer,
    1,
    'patchCounts.partnershipChanges = 1'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'tradeRouteOutcomes'
    )::integer,
    1,
    'patchCounts.tradeRouteOutcomes = 1'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'logEntries'
    )::integer,
    1,
    'patchCounts.logEntries = 1'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'notifications'
    )::integer,
    1,
    'patchCounts.notifications = 1 (loop iterations, not fan-out recipients)'
  );

select
  is (
    (
      current_setting('attfe.last_result', true)::jsonb -> 'patchCounts' ->> 'settlementSnapshots'
    )::integer,
    2,
    'patchCounts.settlementSnapshots = 2'
  );

-- ---------------------------------------------------------------------------
-- Tests 17–19: Wholeness — row counts match payload shape
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots strs
        inner join public.turn_transitions tt on tt.id = strs.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000001'
    ),
    2,
    'wholeness: 2 resource snapshot rows (one per stockpile delta entry)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000001'
    ),
    2,
    'wholeness: 2 settlement snapshot rows (one per settlement in payload)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries tle
        inner join public.turn_transitions tt on tt.id = tle.turn_transition_id
      where
        tle.world_id = 'd6200000-0000-0000-0000-000000000001'
    ),
    1,
    'wholeness: 1 log entry row'
  );

-- ---------------------------------------------------------------------------
-- Tests 20–23: Snapshot completeness — every touched entity has a row
-- ---------------------------------------------------------------------------
select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000001'
        and sts.settlement_id = 'd6400000-0000-0000-0000-000000000001'
    ),
    'snapshot completeness: Settlement 1 has a settlement_turn_snapshots row'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000001'
        and sts.settlement_id = 'd6400000-0000-0000-0000-000000000002'
    ),
    'snapshot completeness: Settlement 2 has a settlement_turn_snapshots row'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots strs
        inner join public.turn_transitions tt on tt.id = strs.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000001'
        and strs.settlement_id = 'd6400000-0000-0000-0000-000000000001'
        and strs.resource_id = 'd6600000-0000-0000-0000-000000000001'
    ),
    'snapshot completeness: Settlement 1 / r1 has a resource snapshot row'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots strs
        inner join public.turn_transitions tt on tt.id = strs.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000001'
        and strs.settlement_id = 'd6400000-0000-0000-0000-000000000002'
        and strs.resource_id = 'd6600000-0000-0000-0000-000000000001'
    ),
    'snapshot completeness: Settlement 2 / r1 has a resource snapshot row'
  );

-- ---------------------------------------------------------------------------
-- Test 24: World advance — current_turn_number incremented by exactly 1
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'd6200000-0000-0000-0000-000000000001'
    ),
    6,
    'world advance: current_turn_number is 6 (was 5 → +1)'
  );

-- ---------------------------------------------------------------------------
-- Tests 25–29: Cross-phase state mutations applied correctly
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        status
      from
        public.citizens
      where
        id = 'd6500000-0000-0000-0000-000000000001'
    ),
    'dead',
    'citizenDeaths: NPC citizen marked dead'
  );

select
  is (
    (
      select
        status
      from
        public.partnerships
      where
        id = 'd6700000-0000-0000-0000-000000000001'
    ),
    'widowed',
    'partnershipChanges: partnership status = widowed'
  );

select
  is (
    (
      select
        status
      from
        public.trade_routes
      where
        id = 'd6800000-0000-0000-0000-000000000001'
    ),
    'paused',
    'tradeRouteOutcomes: trade route status = paused'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'd6500000-0000-0000-0000-000000000003'
    ),
    0,
    'assignmentClears: citizen assignment row deleted'
  );

select
  is (
    (
      select
        born_on_turn_number
      from
        public.citizens
      where
        id = 'd6500000-0000-0000-0000-000000000002'
    ),
    3,
    'bornOnTurnBackfill: born_on_turn_number updated to 3'
  );

-- ---------------------------------------------------------------------------
-- Test 30: Post-advance stale guard — World 1 is now at turn 6; calling
-- with expected_turn = 5 must raise P0001
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'd6200000-0000-0000-0000-000000000001',
      5,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    'P0001',
    null,
    'post-advance stale guard: calling with old expected_turn raises P0001'
  );

-- ===========================================================================
-- WORLD ADMIN SUCCESS: user 002 is an explicit world admin for World 1
-- (world is now at turn 6 after the super admin call above)
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Test 31: World admin can call apply_turn_transition
-- ---------------------------------------------------------------------------
set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    (
      select
        public.apply_turn_transition (
          'd6200000-0000-0000-0000-000000000001',
          6,
          '{}'::jsonb,
          'd6300000-0000-0000-0000-000000000002'::uuid
        ) ->> 'transitionId'
    ) is not null,
    'world admin (explicit world_admins row) can call apply_turn_transition'
  );

reset role;

-- ===========================================================================
-- IDEMPOTENCY: World 3 (turn 7 → 8)
-- First call writes 1 settlement snapshot + 1 resource snapshot.
-- Transition is reset to 'running' and world turn reset to 7.
-- Second call reuses the same transition (unique_violation → EXCEPTION handler).
-- ON CONFLICT DO NOTHING keeps snapshot counts unchanged.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- First call (turn 7 → 8)
select
  public.apply_turn_transition (
    'd6200000-0000-0000-0000-000000000003',
    7,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'd6400000-0000-0000-0000-000000000003',
          'resourceId',
          'd6600000-0000-0000-0000-000000000003',
          'quantityBefore',
          200,
          'quantityAfter',
          180,
          'produced',
          0,
          'consumed',
          20,
          'tradeIn',
          0,
          'tradeOut',
          0
        )
      ),
      'settlementSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'd6400000-0000-0000-0000-000000000003',
          'turnNumber',
          7,
          'aliveTotal',
          20,
          'aliveNpc',
          20,
          'alivePc',
          0,
          'populationCap',
          50,
          'buildingSummary',
          jsonb_build_object(
            'active',
            0,
            'suspended',
            0,
            'auto_deconstructed',
            0,
            'manually_deconstructed',
            0
          ),
          'warnings',
          jsonb_build_object(
            'depletedDepositIds',
            jsonb_build_array(),
            'pausedProjectIds',
            jsonb_build_array()
          )
        )
      )
    ),
    'd6300000-0000-0000-0000-000000000003'::uuid
  );

reset role;

-- Reset the completed transition back to 'running' and the world turn back to
-- 7 to simulate the concurrent-retry path. The second call will hit a
-- unique_violation on the turn_transitions insert and reuse the existing row.
-- Must run as postgres (not authenticated) because authenticated has UPDATE
-- revoked on turn_transitions (20260519000001_protect_turn_audit_writes.sql).
update public.turn_transitions
set
  status = 'running',
  finished_at = null,
  readiness_summary_jsonb = null
where
  world_id = 'd6200000-0000-0000-0000-000000000003'
  and from_turn_number = 7;

update public.worlds
set
  current_turn_number = 7
where
  id = 'd6200000-0000-0000-0000-000000000003';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Second call (retry — reuses existing transition row)
select
  public.apply_turn_transition (
    'd6200000-0000-0000-0000-000000000003',
    7,
    jsonb_build_object(
      'stockpileDeltas',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'd6400000-0000-0000-0000-000000000003',
          'resourceId',
          'd6600000-0000-0000-0000-000000000003',
          'quantityBefore',
          200,
          'quantityAfter',
          180,
          'produced',
          0,
          'consumed',
          20,
          'tradeIn',
          0,
          'tradeOut',
          0
        )
      ),
      'settlementSnapshots',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'd6400000-0000-0000-0000-000000000003',
          'turnNumber',
          7,
          'aliveTotal',
          20,
          'aliveNpc',
          20,
          'alivePc',
          0,
          'populationCap',
          50,
          'buildingSummary',
          jsonb_build_object(
            'active',
            0,
            'suspended',
            0,
            'auto_deconstructed',
            0,
            'manually_deconstructed',
            0
          ),
          'warnings',
          jsonb_build_object(
            'depletedDepositIds',
            jsonb_build_array(),
            'pausedProjectIds',
            jsonb_build_array()
          )
        )
      )
    ),
    'd6300000-0000-0000-0000-000000000003'::uuid
  );

reset role;

-- ---------------------------------------------------------------------------
-- Test 32: Idempotency — settlement_turn_snapshots count = 1 after retry
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_snapshots sts
        inner join public.turn_transitions tt on tt.id = sts.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000003'
    ),
    1,
    'idempotency: ON CONFLICT DO NOTHING keeps exactly 1 settlement snapshot after retry'
  );

-- ---------------------------------------------------------------------------
-- Test 33: Idempotency — settlement_turn_resource_snapshots count = 1 after retry
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots strs
        inner join public.turn_transitions tt on tt.id = strs.turn_transition_id
      where
        tt.world_id = 'd6200000-0000-0000-0000-000000000003'
    ),
    1,
    'idempotency: ON CONFLICT DO NOTHING keeps exactly 1 resource snapshot after retry'
  );

-- ---------------------------------------------------------------------------
-- Test 34: Idempotency — world current_turn_number = 8 (not 9) after retry
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'd6200000-0000-0000-0000-000000000003'
    ),
    8,
    'idempotency: world advances to exactly 8 (not 9) regardless of retries'
  );

select
  finish ();

rollback;
