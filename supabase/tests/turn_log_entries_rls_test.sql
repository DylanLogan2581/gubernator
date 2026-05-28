-- pgTAP tests for public.turn_log_entries constraints and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (12);

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
    '91000000-0000-0000-0000-000000000001',
    'turn-log-owner@example.com',
    'x',
    now(),
    '{"username":"turn_log_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'turn-log-admin@example.com',
    'x',
    now(),
    '{"username":"turn_log_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    'turn-log-outsider@example.com',
    'x',
    now(),
    '{"username":"turn_log_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    'turn-log-superadmin@example.com',
    'x',
    now(),
    '{"username":"turn_log_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000005',
    'turn-log-pc-holder@example.com',
    'x',
    now(),
    '{"username":"turn_log_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000006',
    'turn-log-dead-pc@example.com',
    'x',
    now(),
    '{"username":"turn_log_dead_pc"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '91000000-0000-0000-0000-000000000004';

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
    '92000000-0000-0000-0000-000000000001',
    'Turn Log Private World',
    '91000000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'Turn Log Outsider World',
    '91000000-0000-0000-0000-000000000003',
    7,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'Turn Log Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '94000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'Turn Log Settlement'
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
    role_type
  )
values
  (
    '97000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    'player_character',
    'PC Holder Citizen',
    'alive',
    '91000000-0000-0000-0000-000000000005',
    'none'
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    'player_character',
    'Dead PC Holder Citizen',
    'dead',
    '91000000-0000-0000-0000-000000000006',
    'none'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    finished_at
  )
values
  (
    '95000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    2,
    3,
    '91000000-0000-0000-0000-000000000001',
    'completed',
    now()
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    6,
    7,
    '91000000-0000-0000-0000-000000000003',
    'completed',
    now()
  );

insert into
  public.turn_log_entries (
    id,
    turn_transition_id,
    world_id,
    log_category,
    payload_jsonb
  )
values
  (
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'transition.completed',
    '{"message":"turn completed"}'::jsonb
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
        public.turn_log_entries
    ),
    0,
    'anon cannot read turn log entries'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read or write logs in inaccessible private worlds.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read private-world turn log entries'
  );

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      log_category,
      payload_jsonb
    )
    values (
      '95000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      'transition.denied',
      '{"message":"blocked"}'::jsonb
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert turn log entries into inaccessible worlds'
  );

reset role;

-- ===========================================================================
-- OWNER: world owners can read existing logs but cannot insert directly.
-- Writes are reserved for the privileged advance_world_turn_if_current path.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000001'
    ),
    'owner can read existing turn log entries in their world'
  );

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      id,
      turn_transition_id,
      world_id,
      nation_id,
      settlement_id,
      citizen_id,
      resource_id,
      log_category,
      payload_jsonb
    )
    values (
      '96000000-0000-0000-0000-000000000002',
      '95000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      '97000000-0000-0000-0000-000000000001',
      '98000000-0000-0000-0000-000000000001',
      'settlement.ready_reset',
      '{"settlementName":"Turn Log Settlement"}'::jsonb
    )
  $test$,
    '42501',
    null,
    'owner cannot insert turn log entries directly'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins also cannot insert turn log entries directly.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      id,
      turn_transition_id,
      world_id,
      log_category
    )
    values (
      '96000000-0000-0000-0000-000000000003',
      '95000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      'transition.note'
    )
  $test$,
    '42501',
    null,
    'world admin cannot insert turn log entries directly'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read across worlds but cannot insert directly either.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000001'
    ),
    1,
    'super admin can read turn log entries across worlds'
  );

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      id,
      turn_transition_id,
      world_id,
      log_category
    )
    values (
      '96000000-0000-0000-0000-000000000004',
      '95000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000002',
      'transition.reviewed'
    )
  $test$,
    '42501',
    null,
    'super admin cannot insert turn log entries directly'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: active user with a living PC in the world can read log entries
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000001'
    ),
    'pc holder can read turn log entries in a private world they have PC access to'
  );

reset role;

-- ===========================================================================
-- DEAD PC HOLDER: user whose only PC is dead cannot read via the PC path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000001'
    ),
    'user with only a dead PC cannot read turn log entries via the PC path'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS (postgres test role bypasses revoke and RLS)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      log_category
    )
    values (
      '95000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000001',
      'transition.mismatched_world'
    )
  $test$,
    '23503',
    null,
    'turn log entries require transition and world references to match'
  );

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      nation_id,
      log_category
    )
    values (
      '95000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000002',
      '93000000-0000-0000-0000-000000000001',
      'transition.mismatched_nation'
    )
  $test$,
    '23514',
    null,
    'turn log entries require nation references to stay inside the log world'
  );

rollback;
