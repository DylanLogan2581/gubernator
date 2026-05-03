-- pgTAP tests for public.turn_transitions constraints and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (23);

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
    '81000000-0000-0000-0000-000000000001',
    'turn-transitions-owner@example.com',
    'x',
    now(),
    '{"username":"turn_transitions_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'turn-transitions-admin@example.com',
    'x',
    now(),
    '{"username":"turn_transitions_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000003',
    'turn-transitions-outsider@example.com',
    'x',
    now(),
    '{"username":"turn_transitions_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000004',
    'turn-transitions-superadmin@example.com',
    'x',
    now(),
    '{"username":"turn_transitions_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '81000000-0000-0000-0000-000000000004';

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
    '82000000-0000-0000-0000-000000000001',
    'Turn Transitions Private World',
    '81000000-0000-0000-0000-000000000001',
    4,
    'private',
    'active'
  ),
  (
    '82000000-0000-0000-0000-000000000002',
    'Turn Transitions Public World',
    '81000000-0000-0000-0000-000000000001',
    2,
    'public',
    'active'
  ),
  (
    '82000000-0000-0000-0000-000000000003',
    'Turn Transitions Outsider World',
    '81000000-0000-0000-0000-000000000003',
    6,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000002'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    finished_at,
    readiness_summary_jsonb,
    forecast_snapshot_jsonb
  )
values
  (
    '83000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    3,
    4,
    '81000000-0000-0000-0000-000000000001',
    'completed',
    now(),
    '{"readyCount": 3, "totalCount": 3}'::jsonb,
    '{"nextTurnNumber": 4}'::jsonb
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000002',
    1,
    2,
    '81000000-0000-0000-0000-000000000001',
    'completed',
    now(),
    null,
    null
  ),
  (
    '83000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000003',
    5,
    6,
    '81000000-0000-0000-0000-000000000003',
    'failed',
    now(),
    '{"readyCount": 0, "totalCount": 2}'::jsonb,
    '{"nextTurnNumber": 6}'::jsonb
  );

-- ===========================================================================
-- ANONYMOUS: no read access
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
    ),
    0,
    'anon cannot read turn transitions'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world transitions, not inaccessible private-world
-- transitions, and cannot manage transitions without world admin access.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000002'
    ),
    'outsider can read public-world turn transitions'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read inaccessible private-world turn transitions'
  );

select
  throws_ok (
    $test$
    insert into public.turn_transitions (
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id
    )
    values (
      '82000000-0000-0000-0000-000000000001',
      4,
      5,
      '81000000-0000-0000-0000-000000000003'
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert turn transitions into inaccessible worlds'
  );

select
  throws_ok (
    $test$
    insert into public.turn_transitions (
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id
    )
    values (
      '82000000-0000-0000-0000-000000000002',
      2,
      3,
      '81000000-0000-0000-0000-000000000003'
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert turn transitions into readable public worlds without admin access'
  );

update public.turn_transitions
set
  status = 'failed'
where
  id = '83000000-0000-0000-0000-000000000002';

reset role;

select
  is (
    (
      select
        status
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000002'
    ),
    'completed',
    'outsider cannot update public-world turn transitions without admin access'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.turn_transitions
where
  id = '83000000-0000-0000-0000-000000000002';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot delete public-world turn transitions without admin access'
  );

-- ===========================================================================
-- OWNER: world owners can manage transitions.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000001'
    ),
    'owner can read turn transitions in their world'
  );

select
  lives_ok (
    $test$
    insert into public.turn_transitions (
      id,
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id,
      readiness_summary_jsonb,
      forecast_snapshot_jsonb
    )
    values (
      '83000000-0000-0000-0000-000000000004',
      '82000000-0000-0000-0000-000000000001',
      4,
      5,
      '81000000-0000-0000-0000-000000000001',
      '{"readyCount": 2, "totalCount": 3}'::jsonb,
      '{"nextTurnNumber": 5}'::jsonb
    )
  $test$,
    'owner can insert turn transitions in their world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000004'
        and status = 'running'
        and started_at is not null
        and finished_at is null
        and readiness_summary_jsonb = '{"readyCount": 2, "totalCount": 3}'::jsonb
        and forecast_snapshot_jsonb = '{"nextTurnNumber": 5}'::jsonb
    ),
    'running transition metadata can be stored with nullable completion fields'
  );

select
  lives_ok (
    $test$
    update public.turn_transitions
    set
      status = 'completed',
      finished_at = now()
    where id = '83000000-0000-0000-0000-000000000004'
  $test$,
    'owner can update turn transitions in their world'
  );

select
  lives_ok (
    $test$
    delete from public.turn_transitions
    where id = '83000000-0000-0000-0000-000000000004'
  $test$,
    'owner can delete turn transitions in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage transitions.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.turn_transitions
      where
        id = '83000000-0000-0000-0000-000000000001'
    ),
    'world admin can read turn transitions in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.turn_transitions (
      id,
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id
    )
    values (
      '83000000-0000-0000-0000-000000000005',
      '82000000-0000-0000-0000-000000000001',
      4,
      5,
      '81000000-0000-0000-0000-000000000002'
    )
  $test$,
    'world admin can insert turn transitions in administered world'
  );

select
  lives_ok (
    $test$
    update public.turn_transitions
    set
      status = 'failed',
      finished_at = now()
    where id = '83000000-0000-0000-0000-000000000005'
  $test$,
    'world admin can update turn transitions in administered world'
  );

select
  lives_ok (
    $test$
    delete from public.turn_transitions
    where id = '83000000-0000-0000-0000-000000000005'
  $test$,
    'world admin can delete turn transitions in administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage transitions across worlds.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        id in (
          '83000000-0000-0000-0000-000000000001',
          '83000000-0000-0000-0000-000000000002',
          '83000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read turn transitions across worlds'
  );

select
  lives_ok (
    $test$
    insert into public.turn_transitions (
      id,
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id
    )
    values (
      '83000000-0000-0000-0000-000000000006',
      '82000000-0000-0000-0000-000000000003',
      6,
      7,
      '81000000-0000-0000-0000-000000000004'
    )
  $test$,
    'super admin can insert turn transitions in any world'
  );

select
  lives_ok (
    $test$
    update public.turn_transitions
    set status = 'completed'
    where id = '83000000-0000-0000-0000-000000000006'
  $test$,
    'super admin can update turn transitions in any world'
  );

select
  lives_ok (
    $test$
    delete from public.turn_transitions
    where id = '83000000-0000-0000-0000-000000000006'
  $test$,
    'super admin can delete turn transitions in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.turn_transitions (
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id
    )
    values (
      '82000000-0000-0000-0000-000000000001',
      4,
      6,
      '81000000-0000-0000-0000-000000000001'
    )
  $test$,
    '23514',
    null,
    'turn transitions require the target turn to advance by one'
  );

select
  throws_ok (
    $test$
    insert into public.turn_transitions (
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id,
      status
    )
    values (
      '82000000-0000-0000-0000-000000000001',
      4,
      5,
      '81000000-0000-0000-0000-000000000001',
      'paused'
    )
  $test$,
    '23514',
    null,
    'turn transitions reject unsupported statuses'
  );

select
  throws_ok (
    $test$
    insert into public.turn_transitions (
      world_id,
      from_turn_number,
      to_turn_number,
      initiated_by_user_id
    )
    values (
      '82000000-0000-0000-0000-000000000001',
      -1,
      0,
      '81000000-0000-0000-0000-000000000001'
    )
  $test$,
    '23514',
    null,
    'turn transitions reject negative source turns'
  );

rollback;
