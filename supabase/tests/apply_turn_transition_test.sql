-- pgTAP smoke tests for public.apply_turn_transition().
-- Run with: npx supabase test db
--
-- UUID prefix map (all c1-prefixed ranges, unique to this file):
--   c1100000 = users     c1200000 = worlds
--   c1300000 = turn_transitions   c1400000 = nations
--   c1500000 = settlements        c1600000 = citizens
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
    'c1100000-0000-0000-0000-000000000001',
    'att-superadmin@example.com',
    'x',
    now(),
    '{"username":"att_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1100000-0000-0000-0000-000000000002',
    'att-owner@example.com',
    'x',
    now(),
    '{"username":"att_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1100000-0000-0000-0000-000000000003',
    'att-admin@example.com',
    'x',
    now(),
    '{"username":"att_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1100000-0000-0000-0000-000000000004',
    'att-manager@example.com',
    'x',
    now(),
    '{"username":"att_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1100000-0000-0000-0000-000000000005',
    'att-outsider@example.com',
    'x',
    now(),
    '{"username":"att_outsider"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'c1200000-0000-0000-0000-000000000001',
    'ATT Active World',
    4,
    'private',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000002',
    'ATT Archived World',
    2,
    'private',
    'active'
  ),
  (
    'c1200000-0000-0000-0000-000000000003',
    'ATT Retry World',
    8,
    'private',
    'active'
  );

update public.worlds
set
  status = 'archived',
  archived_at = now()
where
  id = 'c1200000-0000-0000-0000-000000000002';

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c1200000-0000-0000-0000-000000000001',
    'c1100000-0000-0000-0000-000000000003'
  );

-- Manager: living player_character citizen with nation_manager role
insert into
  public.nations (id, world_id, name)
values
  (
    'c1400000-0000-0000-0000-000000000001',
    'c1200000-0000-0000-0000-000000000001',
    'ATT Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c1500000-0000-0000-0000-000000000001',
    'c1400000-0000-0000-0000-000000000001',
    'ATT Settlement'
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
    role_nation_id,
    death_cause_category
  )
values
  (
    'c1600000-0000-0000-0000-000000000001',
    'c1200000-0000-0000-0000-000000000001',
    'c1500000-0000-0000-0000-000000000001',
    'player_character',
    'ATT Manager Citizen',
    'alive',
    'c1100000-0000-0000-0000-000000000004',
    'nation_manager',
    'c1400000-0000-0000-0000-000000000001',
    null
  );

-- Pre-seeded running transitions
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
    'c1300000-0000-0000-0000-000000000001',
    'c1200000-0000-0000-0000-000000000003',
    8,
    9,
    'c1100000-0000-0000-0000-000000000002',
    'running'
  ),
  (
    'c1300000-0000-0000-0000-000000000002',
    'c1200000-0000-0000-0000-000000000001',
    4,
    5,
    'c1100000-0000-0000-0000-000000000001',
    'running'
  ),
  (
    'c1300000-0000-0000-0000-000000000003',
    'c1200000-0000-0000-0000-000000000001',
    5,
    6,
    'c1100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- SERVICE ROLE: happy path — advances turn and returns transitionId
-- ===========================================================================
set
  local role service_role;

select
  ok (
    (
      select
        public.apply_turn_transition (
          'c1200000-0000-0000-0000-000000000001',
          4,
          '{}'::jsonb,
          'c1300000-0000-0000-0000-000000000002'::uuid
        ) ->> 'transitionId'
    ) is not null,
    'service_role can call apply_turn_transition and receives a transitionId'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = 'c1200000-0000-0000-0000-000000000001'
        and from_turn_number = 4
        and status = 'completed'
    ),
    1,
    'service_role call creates a completed turn transition'
  );

-- ===========================================================================
-- SERVICE ROLE: IDEMPOTENT RETRY — pre-existing running transition is reused
-- ===========================================================================
-- World is now at turn 5 after service_role advanced it.
select
  is (
    (
      select
        (
          public.apply_turn_transition (
            'c1200000-0000-0000-0000-000000000003',
            8,
            '{}'::jsonb,
            'c1300000-0000-0000-0000-000000000001'::uuid
          ) ->> 'transitionId'
        )::uuid
    ),
    'c1300000-0000-0000-0000-000000000001'::uuid,
    'retry with existing running transition reuses the same transition id'
  );

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = 'c1300000-0000-0000-0000-000000000001'
    ),
    'completed',
    'reused running transition is marked completed after retry call'
  );

-- ===========================================================================
-- SERVICE ROLE: STALE EXPECTED TURN → P0001
-- ===========================================================================
-- World 1 is now at turn 5, caller claims 99.
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c1200000-0000-0000-0000-000000000001',
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
-- SERVICE ROLE: ARCHIVED WORLD → P0001
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c1200000-0000-0000-0000-000000000002',
      2,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    'P0001',
    null,
    'archived world raises P0001'
  );

-- ===========================================================================
-- SERVICE ROLE: NULL PARAM VALIDATION
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(null, 4, '{}'::jsonb, '00000000-0000-0000-0000-000000000999'::uuid)
  $test$,
    'P0001',
    null,
    'null p_world_id raises P0001'
  );

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c1200000-0000-0000-0000-000000000001',
      null,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    'P0001',
    null,
    'null p_expected_turn_number raises P0001'
  );

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c1200000-0000-0000-0000-000000000001',
      4,
      null,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    'P0001',
    null,
    'null p_payload raises P0001'
  );

reset role;

-- ===========================================================================
-- AUTHENTICATED: super admin is rejected with 42501 (GRANT-level block)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c1200000-0000-0000-0000-000000000001',
      4,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    '42501',
    null,
    'authenticated super admin cannot directly call apply_turn_transition'
  );

-- ===========================================================================
-- AUTHENTICATED: world admin is rejected with 42501 (GRANT-level block)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"c1100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c1200000-0000-0000-0000-000000000001',
      4,
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000999'::uuid
    )
  $test$,
    '42501',
    null,
    'authenticated world admin cannot directly call apply_turn_transition'
  );

reset role;

-- ===========================================================================
-- GRANT CHECK: service_role has EXECUTE; authenticated does not
-- ===========================================================================
select
  ok (
    has_function_privilege(
      'service_role',
      'public.apply_turn_transition(uuid, integer, jsonb, uuid)',
      'EXECUTE'
    ),
    'service_role has EXECUTE on apply_turn_transition'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.apply_turn_transition(uuid, integer, jsonb, uuid)',
      'EXECUTE'
    ),
    'authenticated role does not have EXECUTE on apply_turn_transition'
  );

rollback;
