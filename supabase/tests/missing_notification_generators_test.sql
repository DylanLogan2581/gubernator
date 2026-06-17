-- pgTAP tests for the five notification categories added in
-- 20260720000000_add_missing_notification_generators.sql:
--   construction.paused, partnership.formed, partnership.widowed,
--   trade_route.paused, trade_route.resumed (all settlement-scoped).
-- Run with: npx supabase test db
--
-- UUID prefix map (all e7-prefixed ranges, unique to this file):
--   e7100000 = users            e7200000 = worlds
--   e7300000 = nations          e7400000 = settlements
--   e7500000 = turn_transitions e7600000 = citizens
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   e7100000-0001 = world admin (added to world_admins for all 5 worlds)
--   e7100000-0002 = nation manager (citizen in each world)
--   e7100000-0003 = settlement manager (citizen in each world)
-- Seeded super admin (from seed.sql) is always present and contributes 1 row.
-- Expected recipient count per settlement-scoped world = 4:
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
    'e7100000-0000-0000-0000-000000000001',
    'mng-world-admin@example.com',
    'x',
    now(),
    '{"username":"mng_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e7100000-0000-0000-0000-000000000002',
    'mng-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"mng_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    'e7100000-0000-0000-0000-000000000003',
    'mng-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"mng_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

-- Five worlds, one per new notification category:
--   World 1: construction.paused
--   World 2: partnership.formed
--   World 3: partnership.widowed
--   World 4: trade_route.paused
--   World 5: trade_route.resumed
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'e7200000-0000-0000-0000-000000000001',
    'MNG World 1 (construction.paused)',
    5,
    'private',
    'active'
  ),
  (
    'e7200000-0000-0000-0000-000000000002',
    'MNG World 2 (partnership.formed)',
    5,
    'private',
    'active'
  ),
  (
    'e7200000-0000-0000-0000-000000000003',
    'MNG World 3 (partnership.widowed)',
    5,
    'private',
    'active'
  ),
  (
    'e7200000-0000-0000-0000-000000000004',
    'MNG World 4 (trade_route.paused)',
    5,
    'private',
    'active'
  ),
  (
    'e7200000-0000-0000-0000-000000000005',
    'MNG World 5 (trade_route.resumed)',
    5,
    'private',
    'active'
  );

-- World admin receives notifications for all 5 worlds
insert into
  public.world_admins (world_id, user_id)
values
  (
    'e7200000-0000-0000-0000-000000000001',
    'e7100000-0000-0000-0000-000000000001'
  ),
  (
    'e7200000-0000-0000-0000-000000000002',
    'e7100000-0000-0000-0000-000000000001'
  ),
  (
    'e7200000-0000-0000-0000-000000000003',
    'e7100000-0000-0000-0000-000000000001'
  ),
  (
    'e7200000-0000-0000-0000-000000000004',
    'e7100000-0000-0000-0000-000000000001'
  ),
  (
    'e7200000-0000-0000-0000-000000000005',
    'e7100000-0000-0000-0000-000000000001'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'e7300000-0000-0000-0000-000000000001',
    'e7200000-0000-0000-0000-000000000001',
    'MNG Nation 1'
  ),
  (
    'e7300000-0000-0000-0000-000000000002',
    'e7200000-0000-0000-0000-000000000002',
    'MNG Nation 2'
  ),
  (
    'e7300000-0000-0000-0000-000000000003',
    'e7200000-0000-0000-0000-000000000003',
    'MNG Nation 3'
  ),
  (
    'e7300000-0000-0000-0000-000000000004',
    'e7200000-0000-0000-0000-000000000004',
    'MNG Nation 4'
  ),
  (
    'e7300000-0000-0000-0000-000000000005',
    'e7200000-0000-0000-0000-000000000005',
    'MNG Nation 5'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'e7400000-0000-0000-0000-000000000001',
    'e7300000-0000-0000-0000-000000000001',
    'MNG Settlement 1'
  ),
  (
    'e7400000-0000-0000-0000-000000000002',
    'e7300000-0000-0000-0000-000000000002',
    'MNG Settlement 2'
  ),
  (
    'e7400000-0000-0000-0000-000000000003',
    'e7300000-0000-0000-0000-000000000003',
    'MNG Settlement 3'
  ),
  (
    'e7400000-0000-0000-0000-000000000004',
    'e7300000-0000-0000-0000-000000000004',
    'MNG Settlement 4'
  ),
  (
    'e7400000-0000-0000-0000-000000000005',
    'e7300000-0000-0000-0000-000000000005',
    'MNG Settlement 5'
  );

-- Nation manager citizens: one per world, linked to user e7100000-0002
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
    'e7600000-0000-0000-0000-000000000001',
    'e7200000-0000-0000-0000-000000000001',
    'e7400000-0000-0000-0000-000000000001',
    'player_character',
    'MNG Nation Mgr 1',
    'alive',
    'e7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'e7300000-0000-0000-0000-000000000001'
  ),
  (
    'e7600000-0000-0000-0000-000000000002',
    'e7200000-0000-0000-0000-000000000002',
    'e7400000-0000-0000-0000-000000000002',
    'player_character',
    'MNG Nation Mgr 2',
    'alive',
    'e7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'e7300000-0000-0000-0000-000000000002'
  ),
  (
    'e7600000-0000-0000-0000-000000000003',
    'e7200000-0000-0000-0000-000000000003',
    'e7400000-0000-0000-0000-000000000003',
    'player_character',
    'MNG Nation Mgr 3',
    'alive',
    'e7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'e7300000-0000-0000-0000-000000000003'
  ),
  (
    'e7600000-0000-0000-0000-000000000004',
    'e7200000-0000-0000-0000-000000000004',
    'e7400000-0000-0000-0000-000000000004',
    'player_character',
    'MNG Nation Mgr 4',
    'alive',
    'e7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'e7300000-0000-0000-0000-000000000004'
  ),
  (
    'e7600000-0000-0000-0000-000000000005',
    'e7200000-0000-0000-0000-000000000005',
    'e7400000-0000-0000-0000-000000000005',
    'player_character',
    'MNG Nation Mgr 5',
    'alive',
    'e7100000-0000-0000-0000-000000000002',
    'nation_manager',
    'e7300000-0000-0000-0000-000000000005'
  );

-- Settlement manager citizens: one per world, linked to user e7100000-0003
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
    'e7600000-0000-0000-0000-000000000006',
    'e7200000-0000-0000-0000-000000000001',
    'e7400000-0000-0000-0000-000000000001',
    'player_character',
    'MNG Settlement Mgr 1',
    'alive',
    'e7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'e7400000-0000-0000-0000-000000000001'
  ),
  (
    'e7600000-0000-0000-0000-000000000007',
    'e7200000-0000-0000-0000-000000000002',
    'e7400000-0000-0000-0000-000000000002',
    'player_character',
    'MNG Settlement Mgr 2',
    'alive',
    'e7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'e7400000-0000-0000-0000-000000000002'
  ),
  (
    'e7600000-0000-0000-0000-000000000008',
    'e7200000-0000-0000-0000-000000000003',
    'e7400000-0000-0000-0000-000000000003',
    'player_character',
    'MNG Settlement Mgr 3',
    'alive',
    'e7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'e7400000-0000-0000-0000-000000000003'
  ),
  (
    'e7600000-0000-0000-0000-000000000009',
    'e7200000-0000-0000-0000-000000000004',
    'e7400000-0000-0000-0000-000000000004',
    'player_character',
    'MNG Settlement Mgr 4',
    'alive',
    'e7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'e7400000-0000-0000-0000-000000000004'
  ),
  (
    'e7600000-0000-0000-0000-000000000010',
    'e7200000-0000-0000-0000-000000000005',
    'e7400000-0000-0000-0000-000000000005',
    'player_character',
    'MNG Settlement Mgr 5',
    'alive',
    'e7100000-0000-0000-0000-000000000003',
    'settlement_manager',
    'e7400000-0000-0000-0000-000000000005'
  );

-- Turn transitions: one per world
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
    'e7500000-0000-0000-0000-000000000001',
    'e7200000-0000-0000-0000-000000000001',
    5,
    6,
    'e7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'e7500000-0000-0000-0000-000000000002',
    'e7200000-0000-0000-0000-000000000002',
    5,
    6,
    'e7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'e7500000-0000-0000-0000-000000000003',
    'e7200000-0000-0000-0000-000000000003',
    5,
    6,
    'e7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'e7500000-0000-0000-0000-000000000004',
    'e7200000-0000-0000-0000-000000000004',
    5,
    6,
    'e7100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'e7500000-0000-0000-0000-000000000005',
    'e7200000-0000-0000-0000-000000000005',
    5,
    6,
    'e7100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- All tests run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST SCENARIO 1: construction.paused
-- Settlement-scoped: settlement manager + nation manager + world admin + seeded
-- super admin = 4 recipients.
-- ===========================================================================
select
  public.apply_turn_transition (
    'e7200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'construction.paused',
          'settlementId',
          'e7400000-0000-0000-0000-000000000001'
        )
      )
    ),
    'e7500000-0000-0000-0000-000000000001'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000001'
        and notification_type = 'construction.paused'
    ),
    4,
    'construction.paused: 4 notifications (seeded super admin, world admin, nation mgr, settlement mgr)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000001'
        and notification_type = 'construction.paused'
        and recipient_user_id = 'e7100000-0000-0000-0000-000000000003'
    ),
    1,
    'construction.paused: settlement manager received notification'
  );

-- ===========================================================================
-- TEST SCENARIO 2: partnership.formed
-- Settlement-scoped: 4 recipients.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'e7200000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'partnership.formed',
          'settlementId',
          'e7400000-0000-0000-0000-000000000002'
        )
      )
    ),
    'e7500000-0000-0000-0000-000000000002'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000002'
        and notification_type = 'partnership.formed'
    ),
    4,
    'partnership.formed: 4 notifications (seeded super admin, world admin, nation mgr, settlement mgr)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000002'
        and notification_type = 'partnership.formed'
        and recipient_user_id = 'e7100000-0000-0000-0000-000000000003'
    ),
    1,
    'partnership.formed: settlement manager received notification'
  );

-- ===========================================================================
-- TEST SCENARIO 3: partnership.widowed
-- Settlement-scoped: 4 recipients.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'e7200000-0000-0000-0000-000000000003',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'partnership.widowed',
          'settlementId',
          'e7400000-0000-0000-0000-000000000003'
        )
      )
    ),
    'e7500000-0000-0000-0000-000000000003'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000003'
        and notification_type = 'partnership.widowed'
    ),
    4,
    'partnership.widowed: 4 notifications (seeded super admin, world admin, nation mgr, settlement mgr)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000003'
        and notification_type = 'partnership.widowed'
        and recipient_user_id = 'e7100000-0000-0000-0000-000000000003'
    ),
    1,
    'partnership.widowed: settlement manager received notification'
  );

-- ===========================================================================
-- TEST SCENARIO 4: trade_route.paused
-- Settlement-scoped (origin settlement): 4 recipients.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'e7200000-0000-0000-0000-000000000004',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'trade_route.paused',
          'settlementId',
          'e7400000-0000-0000-0000-000000000004'
        )
      )
    ),
    'e7500000-0000-0000-0000-000000000004'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000004'
        and notification_type = 'trade_route.paused'
    ),
    4,
    'trade_route.paused: 4 notifications (seeded super admin, world admin, nation mgr, settlement mgr)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000004'
        and notification_type = 'trade_route.paused'
        and recipient_user_id = 'e7100000-0000-0000-0000-000000000003'
    ),
    1,
    'trade_route.paused: settlement manager received notification'
  );

-- ===========================================================================
-- TEST SCENARIO 5: trade_route.resumed
-- Settlement-scoped (origin settlement): 4 recipients.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'e7200000-0000-0000-0000-000000000005',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'trade_route.resumed',
          'settlementId',
          'e7400000-0000-0000-0000-000000000005'
        )
      )
    ),
    'e7500000-0000-0000-0000-000000000005'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000005'
        and notification_type = 'trade_route.resumed'
    ),
    4,
    'trade_route.resumed: 4 notifications (seeded super admin, world admin, nation mgr, settlement mgr)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'e7200000-0000-0000-0000-000000000005'
        and notification_type = 'trade_route.resumed'
        and recipient_user_id = 'e7100000-0000-0000-0000-000000000003'
    ),
    1,
    'trade_route.resumed: settlement manager received notification'
  );

rollback;
