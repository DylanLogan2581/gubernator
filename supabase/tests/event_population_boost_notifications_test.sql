-- pgTAP tests for issue #1022: population_boost event effect spawns parentless
-- citizens, writes a typed event.population_boost turn log entry, and reuses
-- the citizen.born per-newborn notification generator (added in
-- 20260808000000_interpolate_citizen_names_in_notifications.sql) for
-- parentless (parent_a_citizen_id/parent_b_citizen_id both null) newborns —
-- a case that generator's `is not distinct from` null-safe match had never
-- been exercised against before this issue.
--
-- Calls internal_apply_turn_transition_log_entries_and_notifications directly
-- (same approach as event_and_citizen_birth_death_notifications_test.sql),
-- with citizens pre-inserted to stand in for what
-- internal_apply_turn_transition_citizen_partnership_patches would already
-- have created earlier in the real apply_turn_transition pipeline.
--
-- UUID prefix map (all c9-prefixed ranges, unique to this file):
--   c9100000 = users        c9200000 = worlds
--   c9300000 = nations      c9400000 = settlements
--   c9500000 = citizens     c9600000 = events
--   c9700000 = turn_transitions
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
    'c9100000-0000-0000-0000-000000000001',
    'epb-world-admin@example.com',
    'x',
    now(),
    '{"username":"epb_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c9100000-0000-0000-0000-000000000002',
    'epb-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"epb_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'c9100000-0000-0000-0000-000000000003',
    'epb-settle-mgr@example.com',
    'x',
    now(),
    '{"username":"epb_settle_mgr"}'::jsonb,
    now(),
    now()
  );

-- public.users rows are auto-created by the on_auth_user_created trigger.
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'c9200000-0000-0000-0000-000000000001',
    'EPB World 1',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c9200000-0000-0000-0000-000000000001',
    'c9100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c9300000-0000-0000-0000-000000000001',
    'c9200000-0000-0000-0000-000000000001',
    'EPB Nation 1'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c9400000-0000-0000-0000-000000000001',
    'c9300000-0000-0000-0000-000000000001',
    'EPB Settlement 1'
  );

-- Nation manager citizen
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
    'c9500000-0000-0000-0000-000000000011',
    'c9200000-0000-0000-0000-000000000001',
    'c9400000-0000-0000-0000-000000000001',
    'player_character',
    'alive',
    'NMgr',
    'male',
    'nation_manager',
    'c9300000-0000-0000-0000-000000000001',
    'c9100000-0000-0000-0000-000000000002'
  );

-- Settlement manager citizen
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
    'c9500000-0000-0000-0000-000000000012',
    'c9200000-0000-0000-0000-000000000001',
    'c9400000-0000-0000-0000-000000000001',
    'player_character',
    'alive',
    'SMgr',
    'female',
    'settlement_manager',
    'c9400000-0000-0000-0000-000000000001',
    'c9100000-0000-0000-0000-000000000003'
  );

-- Two parentless NPC citizens standing in for a population_boost spawn of 2 —
-- both parent_a_citizen_id and parent_b_citizen_id are null, unlike every
-- pre-existing citizen.born notification fixture (partnership births always
-- set both parents).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name,
    surname,
    sex,
    born_on_turn_number,
    parent_a_citizen_id,
    parent_b_citizen_id
  )
values
  (
    'c9500000-0000-0000-0000-000000000091',
    'c9200000-0000-0000-0000-000000000001',
    'c9400000-0000-0000-0000-000000000001',
    'npc',
    'alive',
    'Boosted1',
    'Arrival',
    'male',
    2,
    null,
    null
  ),
  (
    'c9500000-0000-0000-0000-000000000092',
    'c9200000-0000-0000-0000-000000000001',
    'c9400000-0000-0000-0000-000000000001',
    'npc',
    'alive',
    'Boosted2',
    null,
    'female',
    2,
    null,
    null
  );

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
    'c9600000-0000-0000-0000-000000000001',
    'c9200000-0000-0000-0000-000000000001',
    'Population Gain',
    'active',
    'population_boost',
    4,
    'settlement',
    'c9400000-0000-0000-0000-000000000001',
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
    'c9700000-0000-0000-0000-000000000001',
    'c9200000-0000-0000-0000-000000000001',
    5,
    6,
    'c9100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- Test: engineered payload mirrors what phaseEvents emits for a settlement-
-- scoped population_boost effect — a typed event.population_boost log entry
-- plus a citizenBirths entry per spawned citizen (parent ids null).
-- ===========================================================================
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'c9700000-0000-0000-0000-000000000001'::uuid,
          'c9200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            jsonb_build_array(
              jsonb_build_object(
                'category',
                'event.population_boost',
                'phase',
                'events',
                'payload',
                jsonb_build_object(
                  'amount',
                  2,
                  'citizenCount',
                  2,
                  'eventId',
                  'c9600000-0000-0000-0000-000000000001',
                  'settlementId',
                  'c9400000-0000-0000-0000-000000000001'
                )
              )
            ),
            'eventStatusPatches',
            '[]'::jsonb,
            'citizenDeaths',
            '[]'::jsonb,
            'citizenBirths',
            jsonb_build_array(
              jsonb_build_object(
                'settlementId',
                'c9400000-0000-0000-0000-000000000001',
                'givenName',
                'Boosted1',
                'surname',
                'Arrival',
                'parentACitizenId',
                null,
                'parentBCitizenId',
                null,
                'bornOnTurnNumber',
                2
              ),
              jsonb_build_object(
                'settlementId',
                'c9400000-0000-0000-0000-000000000001',
                'givenName',
                'Boosted2',
                'surname',
                null,
                'parentACitizenId',
                null,
                'parentBCitizenId',
                null,
                'bornOnTurnNumber',
                2
              )
            )
          )
        )
    ),
    -- turn.completed (2: world admin + super admin) + citizen.born (2 newborns x
    -- 4 recipients each = 8) = 10 total. event.population_boost has no dedicated
    -- notification generator (only event.activated/event.expired and citizen.born
    -- read from log entries / citizenBirths).
    10,
    'population_boost payload produces 10 notification rows (2 turn.completed + 8 citizen.born)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        turn_transition_id = 'c9700000-0000-0000-0000-000000000001'
        and log_category = 'event.population_boost'
        and payload_jsonb ->> 'eventId' = 'c9600000-0000-0000-0000-000000000001'
        and (payload_jsonb ->> 'citizenCount')::integer = 2
    ),
    1,
    'turn log shows a typed event.population_boost entry with settlement id and citizen count'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'c9700000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.born'
        and citizen_id = 'c9500000-0000-0000-0000-000000000091'
    ),
    4,
    'parentless newborn 1 (Boosted1 Arrival) resolves 4 citizen.born rows despite null parent ids'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = 'c9700000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.born'
        and citizen_id = 'c9500000-0000-0000-0000-000000000092'
    ),
    4,
    'parentless newborn 2 (Boosted2, no surname) resolves 4 citizen.born rows despite null parent ids'
  );

select
  is (
    (
      select distinct
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'c9700000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.born'
        and citizen_id = 'c9500000-0000-0000-0000-000000000091'
    ),
    'Boosted1 Arrival was born in this settlement.',
    'citizen.born message text interpolates the boosted citizen''s full name'
  );

select
  is (
    (
      select distinct
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'c9700000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.born'
        and citizen_id = 'c9500000-0000-0000-0000-000000000092'
    ),
    'Boosted2 was born in this settlement.',
    'citizen.born message text interpolates the boosted citizen''s given name only (no surname)'
  );

select
  finish ();

rollback;
