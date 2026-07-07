-- pgTAP tests for issue #1027: extend the entity-name-interpolation pattern
-- (started in 20260808000000_interpolate_citizen_names_in_notifications.sql
-- for partnership.formed/citizen.born) to every remaining message_text branch
-- of internal_apply_turn_transition_log_entries_and_notifications, per
-- 20260825000000_interpolate_entity_names_in_all_notifications.sql.
--
-- Calls internal_apply_turn_transition_log_entries_and_notifications directly
-- with engineered payloads, matching the pattern established by
-- event_and_citizen_birth_death_notifications_test.sql.
--
-- UUID prefix map (all ca-prefixed ranges, unique to this file):
--   ca100000 = users            ca200000 = worlds
--   ca300000 = nations          ca400000 = settlements
--   ca500000 = turn_transitions ca600000 = citizens
--   ca700000 = building_blueprints/tiers
--   ca800000 = partnerships
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures — one world/nation/settlement, shared across scenarios.
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
    'ca100000-0000-0000-0000-000000000001',
    'nei-settle-mgr@example.com',
    'x',
    now(),
    '{"username":"nei_settle_mgr"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'ca200000-0000-0000-0000-000000000001',
    'NEI World 1',
    5,
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ca300000-0000-0000-0000-000000000001',
    'ca200000-0000-0000-0000-000000000001',
    'NEI Nation 1'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ca400000-0000-0000-0000-000000000001',
    'ca300000-0000-0000-0000-000000000001',
    'NEI Settlement 1'
  );

-- Settlement manager citizen (recipient for all settlement-scoped scenarios).
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
    'ca600000-0000-0000-0000-000000000001',
    'ca200000-0000-0000-0000-000000000001',
    'ca400000-0000-0000-0000-000000000001',
    'player_character',
    'alive',
    'SMgr1',
    'female',
    'settlement_manager',
    'ca400000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001'
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
    'ca500000-0000-0000-0000-000000000001',
    'ca200000-0000-0000-0000-000000000001',
    5,
    6,
    'ca100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- SCENARIO 1: citizen.died interpolates the dead citizen's name.
-- ===========================================================================
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    death_cause_category,
    given_name,
    surname,
    sex
  )
values
  (
    'ca600000-0000-0000-0000-000000000091',
    'ca200000-0000-0000-0000-000000000001',
    'ca400000-0000-0000-0000-000000000001',
    'npc',
    'dead',
    'starvation',
    'Kestrel',
    'Ashford',
    'male'
  );

-- ===========================================================================
-- SCENARIO 2: partnership.widowed interpolates both the survivor's and the
-- deceased partner's names.
-- ===========================================================================
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    death_cause_category,
    given_name,
    surname,
    sex
  )
values
  (
    'ca600000-0000-0000-0000-000000000092',
    'ca200000-0000-0000-0000-000000000001',
    'ca400000-0000-0000-0000-000000000001',
    'npc',
    'alive',
    null,
    'Merek',
    'Weaverson',
    'male'
  ),
  (
    'ca600000-0000-0000-0000-000000000093',
    'ca200000-0000-0000-0000-000000000001',
    'ca400000-0000-0000-0000-000000000001',
    'npc',
    'dead',
    'starvation',
    'Sable',
    'Weaverson',
    'female'
  );

insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number
  )
values
  (
    'ca800000-0000-0000-0000-000000000001',
    'ca600000-0000-0000-0000-000000000092',
    'ca600000-0000-0000-0000-000000000093',
    'widowed',
    2,
    5
  );

-- ===========================================================================
-- SCENARIO 3: building.suspended interpolates the blueprint's name.
-- ===========================================================================
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'ca700000-0000-0000-0000-000000000001',
    'ca200000-0000-0000-0000-000000000001',
    'Granary',
    'granary'
  );

-- ---------------------------------------------------------------------------
-- Drive all three scenarios through one call, engineering payloads that hit
-- each branch directly (bypassing the full apply_turn_transition pipeline,
-- matching event_and_citizen_birth_death_notifications_test.sql).
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'ca500000-0000-0000-0000-000000000001'::uuid,
          'ca200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            jsonb_build_array(
              jsonb_build_object(
                'category',
                'partnership.widowed',
                'settlementId',
                'ca400000-0000-0000-0000-000000000001',
                'payload',
                jsonb_build_object(
                  'partnershipId',
                  'ca800000-0000-0000-0000-000000000001',
                  'survivingCitizenId',
                  'ca600000-0000-0000-0000-000000000092'
                )
              ),
              jsonb_build_object(
                'category',
                'building.suspended',
                'settlementId',
                'ca400000-0000-0000-0000-000000000001',
                'payload',
                jsonb_build_object(
                  'blueprintId',
                  'ca700000-0000-0000-0000-000000000001',
                  'buildingId',
                  'ca700000-0000-0000-0000-000000000099',
                  'missedUpkeepCount',
                  3
                )
              )
            ),
            'eventStatusPatches',
            '[]'::jsonb,
            'citizenDeaths',
            jsonb_build_array(
              jsonb_build_object(
                'citizenId',
                'ca600000-0000-0000-0000-000000000091',
                'deathCauseCategory',
                'starvation',
                'deathCause',
                null
              )
            )
          )
        )
    ),
    7,
    'NEI World 1: 1 citizen.died + 1 partnership.widowed + 1 building.suspended (2 recipients each) + 1 turn.completed (1 recipient)'
  );

select
  is (
    (
      select distinct
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'ca500000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.died'
        and citizen_id = 'ca600000-0000-0000-0000-000000000091'
    ),
    'Kestrel Ashford has died.',
    'citizen.died: message text interpolates the dead citizen''s name'
  );

select
  is (
    (
      select distinct
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'ca500000-0000-0000-0000-000000000001'
        and notification_type = 'partnership.widowed'
    ),
    'Merek Weaverson lost Sable Weaverson this turn.',
    'partnership.widowed: message text interpolates the survivor''s and deceased partner''s names'
  );

select
  is (
    (
      select distinct
        citizen_id
      from
        public.notifications
      where
        generated_in_transition_id = 'ca500000-0000-0000-0000-000000000001'
        and notification_type = 'partnership.widowed'
    ),
    'ca600000-0000-0000-0000-000000000092'::uuid,
    'partnership.widowed: citizen_id links to the surviving citizen'
  );

select
  is (
    (
      select distinct
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'ca500000-0000-0000-0000-000000000001'
        and notification_type = 'building.suspended'
    ),
    'Granary was suspended in NEI Settlement 1 due to insufficient upkeep resources.',
    'building.suspended: message text interpolates the blueprint and settlement names'
  );

-- ===========================================================================
-- SCENARIO 4: sparse payload (no blueprintId/partnershipId data available)
-- still produces a notification, falling back to generic text instead of
-- being silently dropped by a failed join.
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
    'ca500000-0000-0000-0000-000000000002',
    'ca200000-0000-0000-0000-000000000001',
    6,
    7,
    'ca100000-0000-0000-0000-000000000001',
    'running'
  );

select
  is (
    (
      select
        notification_count
      from
        public.internal_apply_turn_transition_log_entries_and_notifications (
          'ca500000-0000-0000-0000-000000000002'::uuid,
          'ca200000-0000-0000-0000-000000000001'::uuid,
          jsonb_build_object(
            'logEntries',
            jsonb_build_array(
              jsonb_build_object(
                'category',
                'building.recovered',
                'settlementId',
                'ca400000-0000-0000-0000-000000000001'
              )
            ),
            'eventStatusPatches',
            '[]'::jsonb,
            'citizenDeaths',
            '[]'::jsonb
          )
        )
    ),
    3,
    'NEI World 1: building.recovered with no payload still produces 2 notifications (settlement mgr + seeded super admin) + 1 turn.completed'
  );

select
  is (
    (
      select distinct
        message_text
      from
        public.notifications
      where
        generated_in_transition_id = 'ca500000-0000-0000-0000-000000000002'
        and notification_type = 'building.recovered'
    ),
    'A building resumed operation in NEI Settlement 1 after upkeep costs were met.',
    'building.recovered: falls back to generic building phrasing when payload has no blueprintId'
  );

rollback;
