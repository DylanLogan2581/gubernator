-- pgTAP tests for public.start_turn_transition().
-- Run with: npx supabase test db
--
-- UUID prefix map (all f1-prefixed ranges, unique to this file):
--   f1100000 = users     f1200000 = worlds
--   f1300000 = turn_transitions
begin;

select
  plan (13);

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
    'f1100000-0000-0000-0000-000000000001',
    'stt-superadmin@example.com',
    'x',
    now(),
    '{"username":"stt_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000002',
    'stt-owner@example.com',
    'x',
    now(),
    '{"username":"stt_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000003',
    'stt-admin@example.com',
    'x',
    now(),
    '{"username":"stt_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000004',
    'stt-manager@example.com',
    'x',
    now(),
    '{"username":"stt_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000005',
    'stt-outsider@example.com',
    'x',
    now(),
    '{"username":"stt_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1100000-0000-0000-0000-000000000001';

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
    'f1200000-0000-0000-0000-000000000001',
    'STT Active World',
    'f1100000-0000-0000-0000-000000000002',
    4,
    'private',
    'active'
  ),
  (
    'f1200000-0000-0000-0000-000000000002',
    'STT Archived World',
    'f1100000-0000-0000-0000-000000000002',
    2,
    'private',
    'active'
  ),
  (
    'f1200000-0000-0000-0000-000000000003',
    'STT Retry World',
    'f1100000-0000-0000-0000-000000000002',
    8,
    'private',
    'active'
  );

update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = 'f1200000-0000-0000-0000-000000000002';

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f1200000-0000-0000-0000-000000000001',
    'f1100000-0000-0000-0000-000000000003'
  );

-- Manager: living player_character citizen with nation_manager role (NOT a world admin)
insert into
  public.nations (id, world_id, name)
values
  (
    'f1400000-0000-0000-0000-000000000001',
    'f1200000-0000-0000-0000-000000000001',
    'STT Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f1500000-0000-0000-0000-000000000001',
    'f1400000-0000-0000-0000-000000000001',
    'STT Settlement'
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
    'f1600000-0000-0000-0000-000000000001',
    'f1200000-0000-0000-0000-000000000001',
    'f1500000-0000-0000-0000-000000000001',
    'player_character',
    'STT Manager Citizen',
    'alive',
    'f1100000-0000-0000-0000-000000000004',
    'nation_manager',
    'f1400000-0000-0000-0000-000000000001',
    null
  );

-- Pre-seeded running transition for idempotent-retry test (Retry World, turn 8→9)
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
    'f1300000-0000-0000-0000-000000000001',
    'f1200000-0000-0000-0000-000000000003',
    8,
    9,
    'f1100000-0000-0000-0000-000000000002',
    'running'
  );

-- ===========================================================================
-- SUPER ADMIN: happy path — returns a UUID and inserts a running transition
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        public.start_turn_transition ('f1200000-0000-0000-0000-000000000001', 4)
    ) is not null,
    'super admin can call start_turn_transition and receives a non-null UUID'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = 'f1200000-0000-0000-0000-000000000001'
        and from_turn_number = 4
        and status = 'running'
    ),
    1,
    'super admin call inserts exactly one running turn_transition row'
  );

-- ===========================================================================
-- WORLD OWNER: implicit world admin via ownership
-- ===========================================================================
-- World 1 is still at turn 4 (start_turn_transition does not advance the world).
set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    (
      select
        public.start_turn_transition ('f1200000-0000-0000-0000-000000000001', 4)
    ) is not null,
    'world owner can call start_turn_transition and receives a non-null UUID'
  );

-- ===========================================================================
-- WORLD ADMIN: explicit world_admins row
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    (
      select
        public.start_turn_transition ('f1200000-0000-0000-0000-000000000001', 4)
    ) is not null,
    'world admin can call start_turn_transition and receives a non-null UUID'
  );

-- ===========================================================================
-- MANAGER: nation_manager PC — not a world admin → 42501
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.start_turn_transition(
      'f1200000-0000-0000-0000-000000000001',
      4
    )
  $test$,
    '42501',
    null,
    'nation manager (non-world-admin) gets 42501 from start_turn_transition'
  );

-- ===========================================================================
-- OUTSIDER: no world access → 42501
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.start_turn_transition(
      'f1200000-0000-0000-0000-000000000001',
      4
    )
  $test$,
    '42501',
    null,
    'outsider gets 42501 from start_turn_transition'
  );

reset role;

-- ===========================================================================
-- ARCHIVED WORLD: → P0001
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.start_turn_transition(
      'f1200000-0000-0000-0000-000000000002',
      2
    )
  $test$,
    'P0001',
    null,
    'archived world raises P0001 from start_turn_transition'
  );

-- ===========================================================================
-- STALE EXPECTED TURN: world is at turn 4, caller claims turn 99 → P0001
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.start_turn_transition(
      'f1200000-0000-0000-0000-000000000001',
      99
    )
  $test$,
    'P0001',
    null,
    'stale expected turn number raises P0001 from start_turn_transition'
  );

-- ===========================================================================
-- NULL PARAM VALIDATION
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.start_turn_transition(null, 4)
  $test$,
    'P0001',
    null,
    'null p_world_id raises P0001'
  );

select
  throws_ok (
    $test$
    select public.start_turn_transition(
      'f1200000-0000-0000-0000-000000000001',
      null
    )
  $test$,
    'P0001',
    null,
    'null p_expected_turn_number raises P0001'
  );

-- ===========================================================================
-- IDEMPOTENT RETRY: unique_violation on existing running row → reuses it
-- ===========================================================================
select
  is (
    (
      select
        public.start_turn_transition ('f1200000-0000-0000-0000-000000000003', 8)
    ),
    'f1300000-0000-0000-0000-000000000001'::uuid,
    'start_turn_transition reuses the existing running transition id on unique_violation'
  );

-- World should NOT advance — start_turn_transition only reserves the row
select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = 'f1200000-0000-0000-0000-000000000003'
    ),
    8,
    'start_turn_transition does not advance the world turn number'
  );

reset role;

-- ===========================================================================
-- GRANT CHECK: authenticated role has EXECUTE; public does not
-- ===========================================================================
select
  ok (
    has_function_privilege(
      'authenticated',
      'public.start_turn_transition(uuid, integer)',
      'EXECUTE'
    ),
    'authenticated role has EXECUTE on start_turn_transition'
  );

rollback;
