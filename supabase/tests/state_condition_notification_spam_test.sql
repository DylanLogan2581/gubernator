-- pgTAP tests for #879: state-condition notification spam fix.
--
-- Verifies that building.suspended, managed_population.declining, and
-- settlement.starvation_occurred generate a notification only on state entry
-- (first turn the condition appears) and not on subsequent turns where the
-- condition persists.
--
-- Strategy: call internal_apply_turn_transition_log_entries_and_notifications
-- directly for two consecutive transitions (T1 then T2) with the same state
-- condition log entry.  After T1 the notification count should be 4 (seeded
-- super admin + world admin + nation mgr + settlement mgr).  After T2 the
-- total must remain 4 — no new rows inserted.
--
-- UUID prefix map (all d7-prefixed ranges, unique to this file):
--   d7100000 = users            d7200000 = worlds
--   d7300000 = nations          d7400000 = settlements
--   d7500000 = turn_transitions d7600000 = citizens
--
-- World layout:
--   World 1: building.suspended
--   World 2: managed_population.declining
--   World 3: settlement.starvation_occurred
begin;

select
  plan (6);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   d7100000-0001 = world admin (added to all three worlds)
--   d7100000-0002 = nation manager (citizen in each world)
--   d7100000-0003 = settlement manager (citizen in each world)
-- Seeded super admin (from seed.sql) is always present → contributes 1 row.
-- Expected recipient count per settlement-scoped notification = 4:
--   seeded super admin + world admin + nation manager + settlement manager
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
    'd7100000-0000-0000-0000-000000000001',
    'scns-wadmin@example.com',
    'x',
    now(),
    '{"username":"scns_wadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd7100000-0000-0000-0000-000000000002',
    'scns-natmgr@example.com',
    'x',
    now(),
    '{"username":"scns_natmgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'd7100000-0000-0000-0000-000000000003',
    'scns-setmgr@example.com',
    'x',
    now(),
    '{"username":"scns_setmgr"}'::jsonb,
    now(),
    now()
  );

-- Three worlds, one per state condition
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'd7200000-0000-0000-0000-000000000001',
    'SCNS World 1 (building.suspended)',
    5,
    'private',
    'active'
  ),
  (
    'd7200000-0000-0000-0000-000000000002',
    'SCNS World 2 (managed_population.declining)',
    5,
    'private',
    'active'
  ),
  (
    'd7200000-0000-0000-0000-000000000003',
    'SCNS World 3 (settlement.starvation_occurred)',
    5,
    'private',
    'active'
  );

-- World admin receives notifications for all three worlds
insert into
  public.world_admins (world_id, user_id)
values
  (
    'd7200000-0000-0000-0000-000000000001',
    'd7100000-0000-0000-0000-000000000001'
  ),
  (
    'd7200000-0000-0000-0000-000000000002',
    'd7100000-0000-0000-0000-000000000001'
  ),
  (
    'd7200000-0000-0000-0000-000000000003',
    'd7100000-0000-0000-0000-000000000001'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'd7300000-0000-0000-0000-000000000001',
    'd7200000-0000-0000-0000-000000000001',
    'SCNS Nation 1'
  ),
  (
    'd7300000-0000-0000-0000-000000000002',
    'd7200000-0000-0000-0000-000000000002',
    'SCNS Nation 2'
  ),
  (
    'd7300000-0000-0000-0000-000000000003',
    'd7200000-0000-0000-0000-000000000003',
    'SCNS Nation 3'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'd7400000-0000-0000-0000-000000000001',
    'd7300000-0000-0000-0000-000000000001',
    'SCNS Settlement 1'
  ),
  (
    'd7400000-0000-0000-0000-000000000002',
    'd7300000-0000-0000-0000-000000000002',
    'SCNS Settlement 2'
  ),
  (
    'd7400000-0000-0000-0000-000000000003',
    'd7300000-0000-0000-0000-000000000003',
    'SCNS Settlement 3'
  );

-- Nation manager citizens: one per world, linked to user d7100000-0002
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
    'd7600000-0000-0000-0000-000000000001',
    'd7200000-0000-0000-0000-000000000001',
    'd7400000-0000-0000-0000-000000000001',
    'player_character',
    'SCNS Nation Mgr 1',
    'alive',
    'd7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'd7300000-0000-0000-0000-000000000001'
  ),
  (
    'd7600000-0000-0000-0000-000000000002',
    'd7200000-0000-0000-0000-000000000002',
    'd7400000-0000-0000-0000-000000000002',
    'player_character',
    'SCNS Nation Mgr 2',
    'alive',
    'd7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'd7300000-0000-0000-0000-000000000002'
  ),
  (
    'd7600000-0000-0000-0000-000000000003',
    'd7200000-0000-0000-0000-000000000003',
    'd7400000-0000-0000-0000-000000000003',
    'player_character',
    'SCNS Nation Mgr 3',
    'alive',
    'd7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'd7300000-0000-0000-0000-000000000003'
  );

-- Settlement manager citizens: one per world, linked to user d7100000-0003
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
    role_settlement_id
  )
values
  (
    'd7600000-0000-0000-0000-000000000004',
    'd7200000-0000-0000-0000-000000000001',
    'd7400000-0000-0000-0000-000000000001',
    'player_character',
    'SCNS Settlement Mgr 1',
    'alive',
    'd7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'd7400000-0000-0000-0000-000000000001'
  ),
  (
    'd7600000-0000-0000-0000-000000000005',
    'd7200000-0000-0000-0000-000000000002',
    'd7400000-0000-0000-0000-000000000002',
    'player_character',
    'SCNS Settlement Mgr 2',
    'alive',
    'd7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'd7400000-0000-0000-0000-000000000002'
  ),
  (
    'd7600000-0000-0000-0000-000000000006',
    'd7200000-0000-0000-0000-000000000003',
    'd7400000-0000-0000-0000-000000000003',
    'player_character',
    'SCNS Settlement Mgr 3',
    'alive',
    'd7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'd7400000-0000-0000-0000-000000000003'
  );

-- Two turn transitions per world.
-- T1 (5→6): the first turn the state condition appears.
-- T2 (6→7): the second turn the condition persists — must produce no new rows.
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
  -- World 1 (building.suspended)
  (
    'd7500000-0000-0000-0000-000000000001',
    'd7200000-0000-0000-0000-000000000001',
    5,
    6,
    'd7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'd7500000-0000-0000-0000-000000000002',
    'd7200000-0000-0000-0000-000000000001',
    6,
    7,
    'd7100000-0000-0000-0000-000000000001',
    'running'
  ),
  -- World 2 (managed_population.declining)
  (
    'd7500000-0000-0000-0000-000000000003',
    'd7200000-0000-0000-0000-000000000002',
    5,
    6,
    'd7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'd7500000-0000-0000-0000-000000000004',
    'd7200000-0000-0000-0000-000000000002',
    6,
    7,
    'd7100000-0000-0000-0000-000000000001',
    'running'
  ),
  -- World 3 (settlement.starvation_occurred)
  (
    'd7500000-0000-0000-0000-000000000005',
    'd7200000-0000-0000-0000-000000000003',
    5,
    6,
    'd7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'd7500000-0000-0000-0000-000000000006',
    'd7200000-0000-0000-0000-000000000003',
    6,
    7,
    'd7100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- SCENARIO 1: building.suspended — two consecutive turns, same settlement
-- ===========================================================================
-- T1: condition first appears → expect 4 notifications (state entry).
select
  *
from
  public.internal_apply_turn_transition_log_entries_and_notifications (
    'd7500000-0000-0000-0000-000000000001'::uuid,
    'd7200000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'building.suspended',
          'settlementId',
          'd7400000-0000-0000-0000-000000000001'
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
        public.notifications
      where
        world_id = 'd7200000-0000-0000-0000-000000000001'
        and notification_type = 'building.suspended'
    ),
    4,
    'building.suspended T1: 4 notifications on state entry (super admin, world admin, nation mgr, settlement mgr)'
  );

-- T2: condition persists → must produce zero new notifications (total stays 4).
select
  *
from
  public.internal_apply_turn_transition_log_entries_and_notifications (
    'd7500000-0000-0000-0000-000000000002'::uuid,
    'd7200000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'building.suspended',
          'settlementId',
          'd7400000-0000-0000-0000-000000000001'
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
        public.notifications
      where
        world_id = 'd7200000-0000-0000-0000-000000000001'
        and notification_type = 'building.suspended'
    ),
    4,
    'building.suspended T2: no new notifications while condition persists (total still 4)'
  );

-- ===========================================================================
-- SCENARIO 2: managed_population.declining — two consecutive turns
-- ===========================================================================
-- T1: condition first appears → expect 4 notifications.
select
  *
from
  public.internal_apply_turn_transition_log_entries_and_notifications (
    'd7500000-0000-0000-0000-000000000003'::uuid,
    'd7200000-0000-0000-0000-000000000002'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'managed_population.declining',
          'settlementId',
          'd7400000-0000-0000-0000-000000000002'
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
        public.notifications
      where
        world_id = 'd7200000-0000-0000-0000-000000000002'
        and notification_type = 'managed_population.declining'
    ),
    4,
    'managed_population.declining T1: 4 notifications on state entry'
  );

-- T2: condition persists → total stays 4.
select
  *
from
  public.internal_apply_turn_transition_log_entries_and_notifications (
    'd7500000-0000-0000-0000-000000000004'::uuid,
    'd7200000-0000-0000-0000-000000000002'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'managed_population.declining',
          'settlementId',
          'd7400000-0000-0000-0000-000000000002'
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
        public.notifications
      where
        world_id = 'd7200000-0000-0000-0000-000000000002'
        and notification_type = 'managed_population.declining'
    ),
    4,
    'managed_population.declining T2: no new notifications while condition persists (total still 4)'
  );

-- ===========================================================================
-- SCENARIO 3: settlement.starvation_occurred — two consecutive turns
-- ===========================================================================
-- T1: condition first appears → expect 4 notifications.
select
  *
from
  public.internal_apply_turn_transition_log_entries_and_notifications (
    'd7500000-0000-0000-0000-000000000005'::uuid,
    'd7200000-0000-0000-0000-000000000003'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'settlement.starvation_occurred',
          'settlementId',
          'd7400000-0000-0000-0000-000000000003'
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
        public.notifications
      where
        world_id = 'd7200000-0000-0000-0000-000000000003'
        and notification_type = 'settlement.starvation_occurred'
    ),
    4,
    'settlement.starvation_occurred T1: 4 notifications on state entry'
  );

-- T2: condition persists → total stays 4.
select
  *
from
  public.internal_apply_turn_transition_log_entries_and_notifications (
    'd7500000-0000-0000-0000-000000000006'::uuid,
    'd7200000-0000-0000-0000-000000000003'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'settlement.starvation_occurred',
          'settlementId',
          'd7400000-0000-0000-0000-000000000003'
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
        public.notifications
      where
        world_id = 'd7200000-0000-0000-0000-000000000003'
        and notification_type = 'settlement.starvation_occurred'
    ),
    4,
    'settlement.starvation_occurred T2: no new notifications while condition persists (total still 4)'
  );

rollback;
