-- pgTAP tests for §C32: apply_turn_transition citizen/partnership patches.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a9-prefixed ranges, unique to this file):
--   a9100000 = users            a9200000 = worlds
--   a9300000 = nations          a9400000 = settlements
--   a9500000 = citizens         a9600000 = partnerships
--   a9700000 = job_definitions  a9800000 = deposit_types
--   a9900000 = deposit_instances
begin;

select
  plan (11);

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
    'a9100000-0000-0000-0000-000000000001',
    'attcp-superadmin@example.com',
    'x',
    now(),
    '{"username":"attcp_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a9100000-0000-0000-0000-000000000001';

-- Seven worlds — one per scenario, all at turn 5:
--   World 1: citizen birth
--   World 2: NPC death
--   World 3: PC death attempt (raises P0001)
--   World 4: assignment clear
--   World 5: partnership formation
--   World 6: partnership widowing
--   World 7: bornOnTurnBackfill + manual_deconstruct_overshoot stamping
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
    'a9200000-0000-0000-0000-000000000001',
    'ATTCP Birth World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'a9200000-0000-0000-0000-000000000002',
    'ATTCP Death World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'a9200000-0000-0000-0000-000000000003',
    'ATTCP PC Death World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'a9200000-0000-0000-0000-000000000004',
    'ATTCP Assignment Clear World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'a9200000-0000-0000-0000-000000000005',
    'ATTCP Partnership Form World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'a9200000-0000-0000-0000-000000000006',
    'ATTCP Partnership Widow World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  ),
  (
    'a9200000-0000-0000-0000-000000000007',
    'ATTCP Backfill World',
    'a9100000-0000-0000-0000-000000000001',
    5,
    'private',
    'active'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'a9300000-0000-0000-0000-000000000001',
    'a9200000-0000-0000-0000-000000000001',
    'ATTCP Nation 1'
  ),
  (
    'a9300000-0000-0000-0000-000000000002',
    'a9200000-0000-0000-0000-000000000002',
    'ATTCP Nation 2'
  ),
  (
    'a9300000-0000-0000-0000-000000000003',
    'a9200000-0000-0000-0000-000000000003',
    'ATTCP Nation 3'
  ),
  (
    'a9300000-0000-0000-0000-000000000004',
    'a9200000-0000-0000-0000-000000000004',
    'ATTCP Nation 4'
  ),
  (
    'a9300000-0000-0000-0000-000000000005',
    'a9200000-0000-0000-0000-000000000005',
    'ATTCP Nation 5'
  ),
  (
    'a9300000-0000-0000-0000-000000000006',
    'a9200000-0000-0000-0000-000000000006',
    'ATTCP Nation 6'
  ),
  (
    'a9300000-0000-0000-0000-000000000007',
    'a9200000-0000-0000-0000-000000000007',
    'ATTCP Nation 7'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'a9400000-0000-0000-0000-000000000001',
    'a9300000-0000-0000-0000-000000000001',
    'ATTCP Settlement 1'
  ),
  (
    'a9400000-0000-0000-0000-000000000002',
    'a9300000-0000-0000-0000-000000000002',
    'ATTCP Settlement 2'
  ),
  (
    'a9400000-0000-0000-0000-000000000003',
    'a9300000-0000-0000-0000-000000000003',
    'ATTCP Settlement 3'
  ),
  (
    'a9400000-0000-0000-0000-000000000004',
    'a9300000-0000-0000-0000-000000000004',
    'ATTCP Settlement 4'
  ),
  (
    'a9400000-0000-0000-0000-000000000005',
    'a9300000-0000-0000-0000-000000000005',
    'ATTCP Settlement 5'
  ),
  (
    'a9400000-0000-0000-0000-000000000006',
    'a9300000-0000-0000-0000-000000000006',
    'ATTCP Settlement 6'
  ),
  (
    'a9400000-0000-0000-0000-000000000007',
    'a9300000-0000-0000-0000-000000000007',
    'ATTCP Settlement 7'
  );

-- NPC citizens for death, assignment-clear, partnership, and backfill worlds
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status
  )
values
  -- World 2: NPC to be killed
  (
    'a9500000-0000-0000-0000-000000000001',
    'a9200000-0000-0000-0000-000000000002',
    'a9400000-0000-0000-0000-000000000002',
    'npc',
    'ATTCP Doomed NPC',
    'alive'
  ),
  -- World 4: citizen with an assignment to be cleared
  (
    'a9500000-0000-0000-0000-000000000003',
    'a9200000-0000-0000-0000-000000000004',
    'a9400000-0000-0000-0000-000000000004',
    'npc',
    'ATTCP Assigned Worker',
    'alive'
  ),
  -- World 5: two citizens for partnership formation
  (
    'a9500000-0000-0000-0000-000000000004',
    'a9200000-0000-0000-0000-000000000005',
    'a9400000-0000-0000-0000-000000000005',
    'npc',
    'ATTCP Partner A1',
    'alive'
  ),
  (
    'a9500000-0000-0000-0000-000000000005',
    'a9200000-0000-0000-0000-000000000005',
    'a9400000-0000-0000-0000-000000000005',
    'npc',
    'ATTCP Partner B1',
    'alive'
  ),
  -- World 6: two citizens with an existing active partnership (to be widowed)
  (
    'a9500000-0000-0000-0000-000000000006',
    'a9200000-0000-0000-0000-000000000006',
    'a9400000-0000-0000-0000-000000000006',
    'npc',
    'ATTCP Partner A2',
    'alive'
  ),
  (
    'a9500000-0000-0000-0000-000000000007',
    'a9200000-0000-0000-0000-000000000006',
    'a9400000-0000-0000-0000-000000000006',
    'npc',
    'ATTCP Partner B2',
    'alive'
  ),
  -- World 7: citizen whose born_on_turn_number needs backfill
  (
    'a9500000-0000-0000-0000-000000000008',
    'a9200000-0000-0000-0000-000000000007',
    'a9400000-0000-0000-0000-000000000007',
    'npc',
    'ATTCP Backfill Citizen',
    'alive'
  );

-- World 3: PC citizen — citizen_type='player_character' requires user_id per table constraint
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    status,
    user_id
  )
values
  (
    'a9500000-0000-0000-0000-000000000002',
    'a9200000-0000-0000-0000-000000000003',
    'a9400000-0000-0000-0000-000000000003',
    'player_character',
    'ATTCP Protected PC',
    'alive',
    'a9100000-0000-0000-0000-000000000001'
  );

-- World 4: job_definition → deposit_type → deposit_instance chain so the
-- citizen can hold a valid 'deposit' assignment to be cleared.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'a9700000-0000-0000-0000-000000000001',
    'a9200000-0000-0000-0000-000000000004',
    'ATTCP Mining 4',
    'attcp-mining-4',
    'deposit'
  );

insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'a9800000-0000-0000-0000-000000000001',
    'a9200000-0000-0000-0000-000000000004',
    'ATTCP Iron Vein 4',
    'attcp-iron-vein-4',
    'a9700000-0000-0000-0000-000000000001',
    10
  );

insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'a9900000-0000-0000-0000-000000000001',
    'a9400000-0000-0000-0000-000000000004',
    'a9800000-0000-0000-0000-000000000001',
    'ATTCP Test Vein 4',
    'active'
  );

-- World 4: seed assignment row for the worker to be cleared
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
values
  (
    'a9500000-0000-0000-0000-000000000003',
    'deposit',
    'a9900000-0000-0000-0000-000000000001',
    4
  );

-- World 6: existing active partnership (to be widowed)
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
    'a9600000-0000-0000-0000-000000000001',
    'a9500000-0000-0000-0000-000000000006',
    'a9500000-0000-0000-0000-000000000007',
    'active',
    2
  );

-- World 7: pre-existing manual_deconstruct_overshoot log entry (turn_transition_id = null)
insert into
  public.turn_log_entries (
    world_id,
    settlement_id,
    log_category,
    turn_transition_id,
    payload_jsonb
  )
values
  (
    'a9200000-0000-0000-0000-000000000007',
    'a9400000-0000-0000-0000-000000000007',
    'manual_deconstruct_overshoot',
    null,
    jsonb_build_object('current_citizens', 5, 'new_cap', 4)
  );

-- ===========================================================================
-- All tests run as super admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a9100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST SCENARIO 1: citizen birth inserts NPC with flavor; no assignment row
-- A new NPC is born in Settlement 1 with npcTrait1 and npcFlaw supplied.
-- Expect: citizen exists with citizen_type='npc' and the supplied flavor.
-- Expect: no citizen_assignments row (newborn is unassigned by absence).
-- ===========================================================================
select
  public.apply_turn_transition (
    'a9200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'citizenBirths',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'a9400000-0000-0000-0000-000000000001',
          'name',
          'ATTCP Newborn NPC',
          'sex',
          'female',
          'bornOnTurnNumber',
          6,
          'parentACitizenId',
          null,
          'parentBCitizenId',
          null,
          'npcTrait1',
          'curious',
          'npcTrait2',
          null,
          'npcSecretContradiction',
          null,
          'npcGoal',
          null,
          'npcFlaw',
          'stubborn'
        )
      )
    )
  );

select
  is (
    (
      select
        c.npc_trait_1
      from
        public.citizens c
      where
        c.settlement_id = 'a9400000-0000-0000-0000-000000000001'
        and c.name = 'ATTCP Newborn NPC'
    ),
    'curious',
    'birth: new NPC is inserted with npc_trait_1 from payload'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
        inner join public.citizens c on c.id = ca.citizen_id
      where
        c.settlement_id = 'a9400000-0000-0000-0000-000000000001'
        and c.name = 'ATTCP Newborn NPC'
    ),
    0,
    'birth: newborn has no citizen_assignments row (unassigned by absence)'
  );

-- ===========================================================================
-- TEST SCENARIO 2: NPC death writes both death columns
-- Expect: status='dead', death_cause_category='starvation', death_cause set.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a9200000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'citizenDeaths',
      jsonb_build_array(
        jsonb_build_object(
          'citizenId',
          'a9500000-0000-0000-0000-000000000001',
          'deathCauseCategory',
          'starvation',
          'deathCause',
          'insufficient grain stores at end of turn'
        )
      )
    )
  );

select
  is (
    (
      select
        c.status
      from
        public.citizens c
      where
        c.id = 'a9500000-0000-0000-0000-000000000001'
    ),
    'dead',
    'death: citizen status updated to dead'
  );

select
  is (
    (
      select
        c.death_cause_category::text
      from
        public.citizens c
      where
        c.id = 'a9500000-0000-0000-0000-000000000001'
    ),
    'starvation',
    'death: death_cause_category written'
  );

select
  is (
    (
      select
        c.death_cause
      from
        public.citizens c
      where
        c.id = 'a9500000-0000-0000-0000-000000000001'
    ),
    'insufficient grain stores at end of turn',
    'death: death_cause written'
  );

-- ===========================================================================
-- TEST SCENARIO 3: PC death attempt raises P0001
-- The simulation engine must never kill a player character; the guard raises.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'a9200000-0000-0000-0000-000000000003',
      5,
      jsonb_build_object(
        'citizenDeaths',
        jsonb_build_array(
          jsonb_build_object(
            'citizenId', 'a9500000-0000-0000-0000-000000000002',
            'deathCauseCategory', 'event',
            'deathCause', 'should not happen'
          )
        )
      )
    )
  $test$,
    'P0001',
    null,
    'PC death attempt raises P0001'
  );

-- ===========================================================================
-- TEST SCENARIO 4: assignment clear deletes citizen_assignments row
-- ===========================================================================
select
  public.apply_turn_transition (
    'a9200000-0000-0000-0000-000000000004',
    5,
    jsonb_build_object(
      'assignmentClears',
      jsonb_build_array(
        jsonb_build_object(
          'citizenId',
          'a9500000-0000-0000-0000-000000000003'
        )
      )
    )
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments
      where
        citizen_id = 'a9500000-0000-0000-0000-000000000003'
    ),
    0,
    'assignment clear: citizen_assignments row deleted'
  );

-- ===========================================================================
-- TEST SCENARIO 5: partnership formation inserts active row
-- ===========================================================================
select
  public.apply_turn_transition (
    'a9200000-0000-0000-0000-000000000005',
    5,
    jsonb_build_object(
      'partnershipChanges',
      jsonb_build_array(
        jsonb_build_object(
          'citizenAId',
          'a9500000-0000-0000-0000-000000000004',
          'citizenBId',
          'a9500000-0000-0000-0000-000000000005',
          'toStatus',
          'active',
          'formedOnTurnNumber',
          6,
          'endedOnTurnNumber',
          null
        )
      )
    )
  );

select
  is (
    (
      select
        p.status
      from
        public.partnerships p
      where
        p.citizen_a_id = 'a9500000-0000-0000-0000-000000000004'
        and p.citizen_b_id = 'a9500000-0000-0000-0000-000000000005'
    ),
    'active',
    'partnership formation: active partnership row inserted'
  );

-- ===========================================================================
-- TEST SCENARIO 6: partnership widowing updates existing active partnership
-- ===========================================================================
select
  public.apply_turn_transition (
    'a9200000-0000-0000-0000-000000000006',
    5,
    jsonb_build_object(
      'partnershipChanges',
      jsonb_build_array(
        jsonb_build_object(
          'citizenAId',
          'a9500000-0000-0000-0000-000000000006',
          'citizenBId',
          'a9500000-0000-0000-0000-000000000007',
          'toStatus',
          'widowed',
          'formedOnTurnNumber',
          null,
          'endedOnTurnNumber',
          6
        )
      )
    )
  );

select
  is (
    (
      select
        p.status
      from
        public.partnerships p
      where
        p.id = 'a9600000-0000-0000-0000-000000000001'
    ),
    'widowed',
    'partnership widowing: existing active partnership status updated to widowed'
  );

-- ===========================================================================
-- TEST SCENARIO 7: bornOnTurnBackfill updates born_on_turn_number exactly once;
-- manual_deconstruct_overshoot log entry is stamped with the transition id.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a9200000-0000-0000-0000-000000000007',
    5,
    jsonb_build_object(
      'bornOnTurnBackfill',
      jsonb_build_array(
        jsonb_build_object(
          'citizenId',
          'a9500000-0000-0000-0000-000000000008',
          'bornOnTurnNumber',
          2
        )
      )
    )
  );

select
  is (
    (
      select
        c.born_on_turn_number
      from
        public.citizens c
      where
        c.id = 'a9500000-0000-0000-0000-000000000008'
    ),
    2,
    'backfill: born_on_turn_number updated to supplied value'
  );

select
  ok (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries tle
        inner join public.turn_transitions tt on tt.id = tle.turn_transition_id
      where
        tle.world_id = 'a9200000-0000-0000-0000-000000000007'
        and tle.log_category = 'manual_deconstruct_overshoot'
        and tt.world_id = 'a9200000-0000-0000-0000-000000000007'
    ) = 1,
    'overshoot stamp: manual_deconstruct_overshoot entry linked to the transition'
  );

reset role;

rollback;
