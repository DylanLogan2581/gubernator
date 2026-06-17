-- pgTAP tests for #883: event.activated/event.expired and citizen.born/citizen.died
-- notification producers added in
-- 20260724000000_add_event_and_citizen_birth_death_notifications.sql.
--
-- Calls internal_apply_turn_transition_log_entries_and_notifications directly,
-- with engineered payloads that drive the four new generator branches.
--
-- UUID prefix map (all b9-prefixed ranges, unique to this file):
--   b9100000 = users            b9200000 = worlds
--   b9300000 = nations          b9400000 = settlements
--   b9500000 = turn_transitions b9600000 = citizens
--   b9700000 = events
--
-- World layout:
--   World 1 (b9200001): settlement-scoped event.activated + event.expired,
--             citizen.born aggregate, citizen.died per-citizen
--   World 2 (b9200002): nation-scoped event.activated
--   World 3 (b9200003): world-scoped event.activated
--   World 4 (b9200004): instant event (pending → expired; both activated + expired)
--
-- Users shared across all worlds:
--   b9100001 = world admin    (world_admins row for all 4 worlds)
--   b9100002 = nation manager (citizen in each world)
--   b9100003 = settlement manager (citizen in each world)
-- Seeded super admin contributes 1 additional row wherever super admins receive.
-- Expected recipient counts:
--   settlement-scoped: 4 (settlement mgr + nation mgr + world admin + super admin)
--   nation-scoped:     3 (nation mgr + world admin + super admin)
--   world-scoped:      2 (world admin + super admin)
begin;

select
  plan (14);

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
    'b9100000-0000-0000-0000-000000000001',
    'ecn-world-admin@example.com',
    'x',
    now(),
    '{"username":"ecn_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b9100000-0000-0000-0000-000000000002',
    'ecn-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"ecn_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'b9100000-0000-0000-0000-000000000003',
    'ecn-settle-mgr@example.com',
    'x',
    now(),
    '{"username":"ecn_settle_mgr"}'::jsonb,
    now(),
    now()
  );

-- public.users rows are auto-created by the on_auth_user_created trigger.
-- ---------------------------------------------------------------------------
-- World 1 — settlement-scoped events + citizen birth/death
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'b9200000-0000-0000-0000-000000000001',
    'ECN World 1',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b9200000-0000-0000-0000-000000000001',
    'b9100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b9300000-0000-0000-0000-000000000001',
    'b9200000-0000-0000-0000-000000000001',
    'ECN Nation 1'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b9400000-0000-0000-0000-000000000001',
    'b9300000-0000-0000-0000-000000000001',
    'ECN Settlement 1'
  );

-- Nation manager citizen for World 1
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name,
    sex,
    role_type,
    role_nation_id,
    user_id
  )
values
  (
    'b9600000-0000-0000-0000-000000000011',
    'b9200000-0000-0000-0000-000000000001',
    'b9400000-0000-0000-0000-000000000001',
    'player_character',
    'alive',
    'NMgr1',
    'male',
    'nation_manager',
    'b9300000-0000-0000-0000-000000000001',
    'b9100000-0000-0000-0000-000000000002'
  );

-- Settlement manager citizen for World 1
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name,
    sex,
    role_type,
    role_settlement_id,
    user_id
  )
values
  (
    'b9600000-0000-0000-0000-000000000012',
    'b9200000-0000-0000-0000-000000000001',
    'b9400000-0000-0000-0000-000000000001',
    'player_character',
    'alive',
    'SMgr1',
    'female',
    'settlement_manager',
    'b9400000-0000-0000-0000-000000000001',
    'b9100000-0000-0000-0000-000000000003'
  );

-- Two NPC citizens in World 1 Settlement 1 that will "die" (simulated via payload)
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    death_cause_category,
    given_name,
    sex
  )
values
  (
    'b9600000-0000-0000-0000-000000000091',
    'b9200000-0000-0000-0000-000000000001',
    'b9400000-0000-0000-0000-000000000001',
    'npc',
    'dead',
    'starvation',
    'DeadNpc1',
    'male'
  ),
  (
    'b9600000-0000-0000-0000-000000000092',
    'b9200000-0000-0000-0000-000000000001',
    'b9400000-0000-0000-0000-000000000001',
    'npc',
    'dead',
    'starvation',
    'DeadNpc2',
    'female'
  );

-- Settlement-scoped sustained event (will be activated this transition)
insert into
  public.events (
    id,
    world_id,
    name,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_settlement_id,
    duration_type,
    duration_transitions,
    remaining_transitions
  )
values
  (
    'b9700000-0000-0000-0000-000000000001',
    'b9200000-0000-0000-0000-000000000001',
    'Plague',
    'active',
    'consumption_multiplier',
    4,
    'settlement',
    'b9400000-0000-0000-0000-000000000001',
    'sustained',
    3,
    2
  );

-- Settlement-scoped sustained event (will expire this transition: fromStatus active → expired)
insert into
  public.events (
    id,
    world_id,
    name,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_settlement_id,
    duration_type,
    duration_transitions,
    remaining_transitions
  )
values
  (
    'b9700000-0000-0000-0000-000000000002',
    'b9200000-0000-0000-0000-000000000001',
    'Drought',
    'expired',
    'consumption_multiplier',
    3,
    'settlement',
    'b9400000-0000-0000-0000-000000000001',
    'sustained',
    3,
    0
  );

-- Transition for World 1
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
    'b9500000-0000-0000-0000-000000000001',
    'b9200000-0000-0000-0000-000000000001',
    5,
    6,
    'b9100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- World 2 — nation-scoped event.activated
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'b9200000-0000-0000-0000-000000000002',
    'ECN World 2',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b9200000-0000-0000-0000-000000000002',
    'b9100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b9300000-0000-0000-0000-000000000002',
    'b9200000-0000-0000-0000-000000000002',
    'ECN Nation 2'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b9400000-0000-0000-0000-000000000002',
    'b9300000-0000-0000-0000-000000000002',
    'ECN Settlement 2'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name,
    sex,
    role_type,
    role_nation_id,
    user_id
  )
values
  (
    'b9600000-0000-0000-0000-000000000021',
    'b9200000-0000-0000-0000-000000000002',
    'b9400000-0000-0000-0000-000000000002',
    'player_character',
    'alive',
    'NMgr2',
    'male',
    'nation_manager',
    'b9300000-0000-0000-0000-000000000002',
    'b9100000-0000-0000-0000-000000000002'
  );

-- Nation-scoped event (activated this transition)
insert into
  public.events (
    id,
    world_id,
    name,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_nation_id,
    duration_type,
    duration_transitions,
    remaining_transitions
  )
values
  (
    'b9700000-0000-0000-0000-000000000003',
    'b9200000-0000-0000-0000-000000000002',
    'Famine',
    'active',
    'consumption_multiplier',
    4,
    'nation',
    'b9300000-0000-0000-0000-000000000002',
    'sustained',
    3,
    2
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
    'b9500000-0000-0000-0000-000000000002',
    'b9200000-0000-0000-0000-000000000002',
    5,
    6,
    'b9100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- World 3 — world-scoped event.activated
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'b9200000-0000-0000-0000-000000000003',
    'ECN World 3',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b9200000-0000-0000-0000-000000000003',
    'b9100000-0000-0000-0000-000000000001'
  );

-- World-scoped event
insert into
  public.events (
    id,
    world_id,
    name,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    duration_type,
    duration_transitions,
    remaining_transitions
  )
values
  (
    'b9700000-0000-0000-0000-000000000004',
    'b9200000-0000-0000-0000-000000000003',
    'Eclipse',
    'active',
    'consumption_multiplier',
    4,
    'world',
    'sustained',
    3,
    2
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
    'b9500000-0000-0000-0000-000000000003',
    'b9200000-0000-0000-0000-000000000003',
    5,
    6,
    'b9100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- World 4 — instant event (pending → expired: both activated + expired fire)
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'b9200000-0000-0000-0000-000000000004',
    'ECN World 4',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b9200000-0000-0000-0000-000000000004',
    'b9100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b9300000-0000-0000-0000-000000000004',
    'b9200000-0000-0000-0000-000000000004',
    'ECN Nation 4'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b9400000-0000-0000-0000-000000000004',
    'b9300000-0000-0000-0000-000000000004',
    'ECN Settlement 4'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name,
    sex,
    role_type,
    role_nation_id,
    user_id
  )
values
  (
    'b9600000-0000-0000-0000-000000000041',
    'b9200000-0000-0000-0000-000000000004',
    'b9400000-0000-0000-0000-000000000004',
    'player_character',
    'alive',
    'NMgr4',
    'male',
    'nation_manager',
    'b9300000-0000-0000-0000-000000000004',
    'b9100000-0000-0000-0000-000000000002'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name,
    sex,
    role_type,
    role_settlement_id,
    user_id
  )
values
  (
    'b9600000-0000-0000-0000-000000000042',
    'b9200000-0000-0000-0000-000000000004',
    'b9400000-0000-0000-0000-000000000004',
    'player_character',
    'alive',
    'SMgr4',
    'female',
    'settlement_manager',
    'b9400000-0000-0000-0000-000000000004',
    'b9100000-0000-0000-0000-000000000003'
  );

-- Settlement-scoped instant event (expired immediately in same transition)
insert into
  public.events (
    id,
    world_id,
    name,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    scope_type,
    scope_settlement_id,
    duration_type
  )
values
  (
    'b9700000-0000-0000-0000-000000000005',
    'b9200000-0000-0000-0000-000000000004',
    'Windfall',
    'expired',
    'resource_grant',
    4,
    'settlement',
    'b9400000-0000-0000-0000-000000000004',
    'instant'
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
    'b9500000-0000-0000-0000-000000000004',
    'b9200000-0000-0000-0000-000000000004',
    5,
    6,
    'b9100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- Tests
-- ---------------------------------------------------------------------------
-- ── World 1, Test 1: event.activated for settlement-scoped sustained event ──
-- Patch: fromStatus=pending → toStatus=active (activation, not expiry)
-- Expected 4 recipients: settle mgr + nation mgr + world admin + seeded super admin
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000001'::uuid,
          'b9200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            '[]'::jsonb,
            'eventStatusPatches',
            jsonb_build_array(
              jsonb_build_object(
                'eventId',
                'b9700000-0000-0000-0000-000000000001',
                'fromStatus',
                'pending',
                'toStatus',
                'active',
                'remainingTransitions',
                2
              )
            ),
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    -- turn.completed (2: world admin + super admin) + event.activated (4)
    6,
    'World 1: settlement-scoped event.activated produces 4 rows (+ 2 turn.completed = 6 total)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'b9500000-0000-0000-0000-000000000001'
        and notification_type = 'event.activated'
        and event_id = 'b9700000-0000-0000-0000-000000000001'
    ),
    4,
    'World 1: 4 event.activated rows with correct event_id'
  );

-- ── World 1, Test 3: event.expired for settlement-scoped event ──
-- Patch: fromStatus=active → toStatus=expired  (no activated, only expired)
select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'b9500000-0000-0000-0000-000000000001'
        and notification_type = 'event.expired'
        -- (initial call already ran above; add the expired patch in a 2nd call to
        --  the same transition to reuse the fixture without a new transition row)
    ),
    0,
    'World 1: no event.expired rows yet before expired patch is injected'
  );

-- Re-call with the expired patch.  Turn.completed deduplicates (0 new rows);
-- event.expired for event 2 produces 4 new rows.
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000001'::uuid,
          'b9200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            '[]'::jsonb,
            'eventStatusPatches',
            jsonb_build_array(
              jsonb_build_object(
                'eventId',
                'b9700000-0000-0000-0000-000000000002',
                'fromStatus',
                'active',
                'toStatus',
                'expired',
                'remainingTransitions',
                0
              )
            ),
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    4,
    'World 1: settlement-scoped event.expired produces 4 rows (turn.completed deduped)'
  );

-- ── World 1, Test 5: citizen.born aggregate ──
-- Two citizen.born log entries for the same settlement → 1 notification × 4 recipients
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000001'::uuid,
          'b9200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            jsonb_build_array(
              jsonb_build_object(
                'category',
                'citizen.born',
                'settlementId',
                'b9400000-0000-0000-0000-000000000001',
                'payload',
                '{}'::jsonb
              ),
              jsonb_build_object(
                'category',
                'citizen.born',
                'settlementId',
                'b9400000-0000-0000-0000-000000000001',
                'payload',
                '{}'::jsonb
              )
            ),
            'eventStatusPatches',
            '[]'::jsonb,
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    4,
    'World 1: two citizen.born log entries in same settlement → 4 aggregate rows (+ already-deduped rest)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'b9500000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.born'
        and citizen_id is null
    ),
    4,
    'World 1: citizen.born notifications have no citizen_id (aggregate)'
  );

-- ── World 1, Test 7 & 8: citizen.died per-citizen ──
-- Two dead NPCs in the payload → 4 rows each (2 × 4 = 8 new rows)
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000001'::uuid,
          'b9200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            '[]'::jsonb,
            'eventStatusPatches',
            '[]'::jsonb,
            'citizenDeaths',
            jsonb_build_array(
              jsonb_build_object(
                'citizenId',
                'b9600000-0000-0000-0000-000000000091',
                'deathCauseCategory',
                'starvation',
                'deathCause',
                null
              ),
              jsonb_build_object(
                'citizenId',
                'b9600000-0000-0000-0000-000000000092',
                'deathCauseCategory',
                'starvation',
                'deathCause',
                null
              )
            )
          )
        )
    ),
    8,
    'World 1: two citizen.died entries → 8 per-citizen rows (4 per citizen)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'b9500000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.died'
        and citizen_id = 'b9600000-0000-0000-0000-000000000091'
    ),
    4,
    'World 1: 4 citizen.died rows for citizen b9600000…0091'
  );

-- ── World 2: nation-scoped event.activated ──
-- Recipients: nation manager + world admin + seeded super admin = 3
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000002'::uuid,
          'b9200000-0000-0000-0000-000000000002'::uuid,
          jsonb_build_object(
            'logEntries',
            '[]'::jsonb,
            'eventStatusPatches',
            jsonb_build_array(
              jsonb_build_object(
                'eventId',
                'b9700000-0000-0000-0000-000000000003',
                'fromStatus',
                'pending',
                'toStatus',
                'active',
                'remainingTransitions',
                2
              )
            ),
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    -- turn.completed (2) + event.activated (3)
    5,
    'World 2: nation-scoped event.activated produces 3 rows (+ 2 turn.completed = 5 total)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'b9500000-0000-0000-0000-000000000002'
        and notification_type = 'event.activated'
    ),
    3,
    'World 2: 3 event.activated notification rows (no settlement manager — nation scope)'
  );

-- ── World 3: world-scoped event.activated ──
-- Recipients: world admin + seeded super admin = 2
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000003'::uuid,
          'b9200000-0000-0000-0000-000000000003'::uuid,
          jsonb_build_object(
            'logEntries',
            '[]'::jsonb,
            'eventStatusPatches',
            jsonb_build_array(
              jsonb_build_object(
                'eventId',
                'b9700000-0000-0000-0000-000000000004',
                'fromStatus',
                'pending',
                'toStatus',
                'active',
                'remainingTransitions',
                2
              )
            ),
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    -- turn.completed (2) + event.activated (2) = 4, but deduped against each other
    -- world admin + super admin each get turn.completed AND event.activated = 4 total
    4,
    'World 3: world-scoped event.activated produces 2 rows (+ 2 turn.completed = 4 total)'
  );

-- ── World 4: instant event — both activated and expired fire ──
-- fromStatus=pending, toStatus=expired → event.activated (4) + event.expired (4) = 8
-- turn.completed = 2 → total 10
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000004'::uuid,
          'b9200000-0000-0000-0000-000000000004'::uuid,
          jsonb_build_object(
            'logEntries',
            '[]'::jsonb,
            'eventStatusPatches',
            jsonb_build_array(
              jsonb_build_object(
                'eventId',
                'b9700000-0000-0000-0000-000000000005',
                'fromStatus',
                'pending',
                'toStatus',
                'expired',
                'remainingTransitions',
                null
              )
            ),
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    10,
    'World 4: instant event emits both event.activated (4) and event.expired (4) + turn.completed (2) = 10'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'b9500000-0000-0000-0000-000000000004'
        and notification_type in ('event.activated', 'event.expired')
    ),
    8,
    'World 4: 8 event notification rows total (4 activated + 4 expired) for instant event'
  );

-- ── Dedup: re-calling World 1 transition with same payload adds 0 rows ──
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'b9500000-0000-0000-0000-000000000001'::uuid,
          'b9200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            jsonb_build_array(
              jsonb_build_object(
                'category',
                'citizen.born',
                'settlementId',
                'b9400000-0000-0000-0000-000000000001',
                'payload',
                '{}'::jsonb
              )
            ),
            'eventStatusPatches',
            jsonb_build_array(
              jsonb_build_object(
                'eventId',
                'b9700000-0000-0000-0000-000000000001',
                'fromStatus',
                'pending',
                'toStatus',
                'active',
                'remainingTransitions',
                2
              )
            ),
            'citizenDeaths',
            jsonb_build_array(
              jsonb_build_object(
                'citizenId',
                'b9600000-0000-0000-0000-000000000091',
                'deathCauseCategory',
                'starvation',
                'deathCause',
                null
              )
            )
          )
        )
    ),
    0,
    'Dedup: calling same transition again with same payloads inserts 0 rows'
  );

select
  finish ();

rollback;
