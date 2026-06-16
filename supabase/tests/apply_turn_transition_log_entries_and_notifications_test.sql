-- pgTAP tests for §C33: apply_turn_transition log entry bulk-insert and
-- notification fan-out with scoped recipients (§4.15).
-- Run with: npx supabase test db
--
-- UUID prefix map (all b1-prefixed ranges, unique to this file):
--   b1100000 = users            b1200000 = worlds
--   b1300000 = nations          b1400000 = settlements
--   b1500000 = citizens
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users:
--   b1100000-0001 = super admin (world owner for all worlds)
--   b1100000-0002 = explicit world admin for World 1
--   b1100000-0003 = nation manager for World 1 / Nation 1
--   b1100000-0004 = settlement manager for World 1 / Settlement 1
--   b1100000-0005 = explicit world admin for World 3
--   b1100000-0006 = nation manager for World 3 / Nation 3
--   b1100000-0007 = explicit world admin for World 4
--   b1100000-0008 = nation manager for World 4 / Nation 4
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
    'b1100000-0000-0000-0000-000000000001',
    'atln-superadmin@example.com',
    'x',
    now(),
    '{"username":"atln_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000002',
    'atln-wadmin1@example.com',
    'x',
    now(),
    '{"username":"atln_wadmin1"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000003',
    'atln-natmgr1@example.com',
    'x',
    now(),
    '{"username":"atln_natmgr1"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000004',
    'atln-setmgr1@example.com',
    'x',
    now(),
    '{"username":"atln_setmgr1"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000005',
    'atln-wadmin3@example.com',
    'x',
    now(),
    '{"username":"atln_wadmin3"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000006',
    'atln-natmgr3@example.com',
    'x',
    now(),
    '{"username":"atln_natmgr3"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000007',
    'atln-wadmin4@example.com',
    'x',
    now(),
    '{"username":"atln_wadmin4"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-0000-0000-000000000008',
    'atln-natmgr4@example.com',
    'x',
    now(),
    '{"username":"atln_natmgr4"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b1100000-0000-0000-0000-000000000001';

-- Six worlds, all at turn 5:
--   World 1: settlement-scoped test (settlement + nation manager + world admin)
--   World 2: settlement-scoped, no active managers → falls back to world admins
--   World 3: nation-scoped test (nation manager + world admin, no settlement manager)
--   World 4: nation-scoped test (nation manager + world admin + super admins, 4 total)
--   World 5: retry dedup test
--   World 6: §C32e overshoot-stamp test
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'b1200000-0000-0000-0000-000000000001',
    'ATLN World 1',
    5,
    'private',
    'active'
  ),
  (
    'b1200000-0000-0000-0000-000000000002',
    'ATLN World 2',
    5,
    'private',
    'active'
  ),
  (
    'b1200000-0000-0000-0000-000000000003',
    'ATLN World 3',
    5,
    'private',
    'active'
  ),
  (
    'b1200000-0000-0000-0000-000000000004',
    'ATLN World 4',
    5,
    'private',
    'active'
  ),
  (
    'b1200000-0000-0000-0000-000000000005',
    'ATLN World 5',
    5,
    'private',
    'active'
  ),
  (
    'b1200000-0000-0000-0000-000000000006',
    'ATLN World 6',
    5,
    'private',
    'active'
  );

-- Explicit world admins (separate from owner)
insert into
  public.world_admins (world_id, user_id)
values
  (
    'b1200000-0000-0000-0000-000000000001',
    'b1100000-0000-0000-0000-000000000002'
  ),
  (
    'b1200000-0000-0000-0000-000000000003',
    'b1100000-0000-0000-0000-000000000005'
  ),
  (
    'b1200000-0000-0000-0000-000000000004',
    'b1100000-0000-0000-0000-000000000007'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'b1300000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000001',
    'ATLN Nation 1'
  ),
  (
    'b1300000-0000-0000-0000-000000000002',
    'b1200000-0000-0000-0000-000000000002',
    'ATLN Nation 2'
  ),
  (
    'b1300000-0000-0000-0000-000000000003',
    'b1200000-0000-0000-0000-000000000003',
    'ATLN Nation 3'
  ),
  (
    'b1300000-0000-0000-0000-000000000004',
    'b1200000-0000-0000-0000-000000000004',
    'ATLN Nation 4'
  ),
  (
    'b1300000-0000-0000-0000-000000000005',
    'b1200000-0000-0000-0000-000000000005',
    'ATLN Nation 5'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'b1400000-0000-0000-0000-000000000001',
    'b1300000-0000-0000-0000-000000000001',
    'ATLN Settlement 1'
  ),
  (
    'b1400000-0000-0000-0000-000000000002',
    'b1300000-0000-0000-0000-000000000002',
    'ATLN Settlement 2'
  ),
  (
    'b1400000-0000-0000-0000-000000000003',
    'b1300000-0000-0000-0000-000000000003',
    'ATLN Settlement 3'
  ),
  (
    'b1400000-0000-0000-0000-000000000004',
    'b1300000-0000-0000-0000-000000000004',
    'ATLN Settlement 4'
  ),
  (
    'b1400000-0000-0000-0000-000000000005',
    'b1300000-0000-0000-0000-000000000005',
    'ATLN Settlement 5'
  );

-- Player character citizens with manager roles
-- Citizens for World 1: nation manager (user b1100000-0003) + settlement manager (user b1100000-0004)
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
    'b1500000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000001',
    'b1400000-0000-0000-0000-000000000001',
    'player_character',
    'ATLN Nation Mgr 1',
    'alive',
    'b1100000-0000-0000-0000-000000000003',
    'nation_manager',
    'b1300000-0000-0000-0000-000000000001'
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
    role_settlement_id
  )
values
  (
    'b1500000-0000-0000-0000-000000000002',
    'b1200000-0000-0000-0000-000000000001',
    'b1400000-0000-0000-0000-000000000001',
    'player_character',
    'ATLN Settlement Mgr 1',
    'alive',
    'b1100000-0000-0000-0000-000000000004',
    'settlement_manager',
    'b1400000-0000-0000-0000-000000000001'
  );

-- Citizen for World 3: nation manager (user b1100000-0006)
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
    'b1500000-0000-0000-0000-000000000003',
    'b1200000-0000-0000-0000-000000000003',
    'b1400000-0000-0000-0000-000000000003',
    'player_character',
    'ATLN Nation Mgr 3',
    'alive',
    'b1100000-0000-0000-0000-000000000006',
    'nation_manager',
    'b1300000-0000-0000-0000-000000000003'
  );

-- Citizen for World 4: nation manager (user b1100000-0008)
-- This user should NOT receive world-scoped notifications.
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
    'b1500000-0000-0000-0000-000000000004',
    'b1200000-0000-0000-0000-000000000004',
    'b1400000-0000-0000-0000-000000000004',
    'player_character',
    'ATLN Nation Mgr 4',
    'alive',
    'b1100000-0000-0000-0000-000000000008',
    'nation_manager',
    'b1300000-0000-0000-0000-000000000004'
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
    'b1300000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000001',
    5,
    6,
    'b1100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'b1300000-0000-0000-0000-000000000002',
    'b1200000-0000-0000-0000-000000000002',
    5,
    6,
    'b1100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'b1300000-0000-0000-0000-000000000003',
    'b1200000-0000-0000-0000-000000000003',
    5,
    6,
    'b1100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'b1300000-0000-0000-0000-000000000004',
    'b1200000-0000-0000-0000-000000000004',
    5,
    6,
    'b1100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'b1300000-0000-0000-0000-000000000005',
    'b1200000-0000-0000-0000-000000000005',
    5,
    6,
    'b1100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'b1300000-0000-0000-0000-000000000006',
    'b1200000-0000-0000-0000-000000000006',
    5,
    6,
    'b1100000-0000-0000-0000-000000000001',
    'running'
  );

-- Out-of-band overshoot log entry (turn_transition_id IS NULL — written by
-- manual_deconstruct_settlement_building RPC before the turn ran).
insert into
  public.turn_log_entries (
    id,
    world_id,
    log_category,
    turn_transition_id,
    payload_jsonb
  )
values
  (
    'b1600000-0000-0000-0000-000000000001',
    'b1200000-0000-0000-0000-000000000006',
    'manual_deconstruct_overshoot',
    null,
    '{"settlement_building_id":"test-building","current_citizens":8,"new_cap":5}'
  ),
  -- A second entry with a different category that must NOT be stamped.
  (
    'b1600000-0000-0000-0000-000000000002',
    'b1200000-0000-0000-0000-000000000006',
    'citizen.died_homeless',
    null,
    '{}'
  );

-- ===========================================================================
-- All tests run as service_role
-- ===========================================================================
set
  local role service_role;

-- ===========================================================================
-- TEST SCENARIO 1: Settlement-scoped notification fans out to settlement
-- manager + nation manager + world admins (owner + explicit admin + super admin).
-- World 1: super admin (owner), world admin B, nation manager C, settlement manager D.
-- Expected: 4 distinct recipients.
-- ===========================================================================
select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'settlement.starvation_occurred',
          'settlementId',
          'b1400000-0000-0000-0000-000000000001',
          'payload',
          jsonb_build_object('deaths', 2)
        )
      ),
      'notifications',
      jsonb_build_array(
        jsonb_build_object(
          'notificationType',
          'settlement.starvation_occurred',
          'messageText',
          '2 citizen(s) starved in ATLN Settlement 1.',
          'scope',
          'settlement',
          'settlementId',
          'b1400000-0000-0000-0000-000000000001'
        )
      )
    ),
    'b1300000-0000-0000-0000-000000000001'::uuid
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
        world_id = 'b1200000-0000-0000-0000-000000000001'
    ),
    8,
    'settlement-scoped: 8 notifications (5 starvation + 3 turn.completed: world admin + owner super admin + seeded super admin)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'b1200000-0000-0000-0000-000000000001'
        and recipient_user_id = 'b1100000-0000-0000-0000-000000000004'
    ),
    1,
    'settlement-scoped: settlement manager received notification'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'b1200000-0000-0000-0000-000000000001'
        and recipient_user_id = 'b1100000-0000-0000-0000-000000000003'
    ),
    1,
    'settlement-scoped: nation manager received notification'
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
        tle.world_id = 'b1200000-0000-0000-0000-000000000001'
        and tle.log_category = 'settlement.starvation_occurred'
        and tle.settlement_id = 'b1400000-0000-0000-0000-000000000001'
        and tt.world_id = 'b1200000-0000-0000-0000-000000000001'
    ),
    1,
    'settlement-scoped: log entry inserted with settlement_id stamped'
  );

-- ===========================================================================
-- TEST SCENARIO 2: Settlement-scoped notification with no active managers
-- falls back to world admins only.
-- World 2: super admin is world owner only. No explicit world_admins, no managers.
-- Expected: 1 notification (super admin / owner).
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000002',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'building.suspended',
          'settlementId',
          'b1400000-0000-0000-0000-000000000002'
        )
      )
    ),
    'b1300000-0000-0000-0000-000000000002'::uuid
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
        world_id = 'b1200000-0000-0000-0000-000000000002'
    ),
    4,
    'no-managers fallback: 4 notifications (2 building.suspended + 2 turn.completed for 2 super admins, no world admins in world 2)'
  );

-- ===========================================================================
-- TEST SCENARIO 3: Nation-scoped notification fans out to nation manager
-- + world admins (owner + explicit admin + super admin).
-- World 3: super admin (owner), world admin E, nation manager F.
-- Expected: 3 notifications.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000003',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'deposit.depleted',
          'nationId',
          'b1300000-0000-0000-0000-000000000003'
        )
      )
    ),
    'b1300000-0000-0000-0000-000000000003'::uuid
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
        world_id = 'b1200000-0000-0000-0000-000000000003'
    ),
    7,
    'nation-scoped: 7 notifications (4 deposit.depleted + 3 turn.completed: world admin + super admin/owner + seeded super admin)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'b1200000-0000-0000-0000-000000000003'
        and recipient_user_id = 'b1100000-0000-0000-0000-000000000006'
    ),
    1,
    'nation-scoped: nation manager received notification'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'b1200000-0000-0000-0000-000000000003'
        and recipient_user_id = 'b1100000-0000-0000-0000-000000000005'
    ),
    2,
    'nation-scoped: explicit world admin received deposit.depleted + turn.completed (2 total)'
  );

-- ===========================================================================
-- TEST SCENARIO 4: Nation-scoped notification (deposit.depleted) fans out to
-- nation manager H + world admin G + super admin owner + seeded super admin.
-- World 4: super admin (owner), world admin G, nation manager H.
-- Expected: 4 notifications (H included as nation manager).
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000004',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'deposit.depleted',
          'nationId',
          'b1300000-0000-0000-0000-000000000004'
        )
      )
    ),
    'b1300000-0000-0000-0000-000000000004'::uuid
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
        world_id = 'b1200000-0000-0000-0000-000000000004'
    ),
    7,
    'nation-scoped in world 4: 7 notifications (4 deposit.depleted + 3 turn.completed: world admin g + owner + seeded super admin)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'b1200000-0000-0000-0000-000000000004'
        and recipient_user_id = 'b1100000-0000-0000-0000-000000000008'
    ),
    1,
    'nation-scoped in world 4: nation manager h received notification'
  );

-- ===========================================================================
-- TEST SCENARIO 5: Retry produces no duplicate notification rows.
-- World 5: super admin as world owner only (1 recipient).
-- First call → 1 notification. Reset transition to 'running'. Second call
-- (reuses same transition_id via EXCEPTION handler) → ON CONFLICT DO NOTHING
-- keeps count at 1.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000005',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'construction.completed',
          'settlementId',
          'b1400000-0000-0000-0000-000000000005'
        )
      )
    ),
    'b1300000-0000-0000-0000-000000000005'::uuid
  );

reset role;

-- Reset transition to 'running' and world turn back to 5 to simulate the
-- concurrent-reuse path: the next call will hit unique_violation on insert
-- and reuse this row. The world turn must also be reset because §C35a
-- advanced it during the first call; without the reset the second call
-- would get "stale expected turn number" before reaching the reuse path.
-- Must run as postgres (superuser) because authenticated has UPDATE revoked
-- on turn_transitions (20260519000001_protect_turn_audit_writes.sql).
update public.turn_transitions
set
  status = 'running',
  finished_at = null,
  readiness_summary_jsonb = null
where
  world_id = 'b1200000-0000-0000-0000-000000000005'
  and from_turn_number = 5;

update public.worlds
set
  current_turn_number = 5
where
  id = 'b1200000-0000-0000-0000-000000000005';

set
  local role service_role;

select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000005',
    5,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'construction.completed',
          'settlementId',
          'b1400000-0000-0000-0000-000000000005'
        )
      )
    ),
    'b1300000-0000-0000-0000-000000000005'::uuid
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
        world_id = 'b1200000-0000-0000-0000-000000000005'
    ),
    4,
    'retry: ON CONFLICT DO NOTHING prevents duplicate rows (2 construction.completed + 2 turn.completed for 2 super admins, no doubles)'
  );

reset role;

-- ===========================================================================
-- TEST SCENARIO 6: §C32e stamps manual_deconstruct_overshoot log entries that
-- have turn_transition_id IS NULL; entries with other categories are left alone.
-- World 6: one overshoot entry + one non-overshoot entry, both null-stamped before the call.
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'b1200000-0000-0000-0000-000000000006',
    5,
    '{}'::jsonb,
    'b1300000-0000-0000-0000-000000000006'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        world_id = 'b1200000-0000-0000-0000-000000000006'
        and log_category = 'manual_deconstruct_overshoot'
        and turn_transition_id is not null
    ),
    1,
    '§C32e: overshoot entry has turn_transition_id stamped after apply_turn_transition'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        world_id = 'b1200000-0000-0000-0000-000000000006'
        and log_category = 'citizen.died_homeless'
        and turn_transition_id is null
    ),
    1,
    '§C32e: non-overshoot entry with null transition_id is not stamped'
  );

rollback;
