-- pgTAP tests for public.turn_log_entries constraints and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (11);

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
-- OWNER: a basic transition can write and read a log entry.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
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
    'owner can insert one turn log entry for a transition'
  );

select
  ok (
    exists (
      select
        1
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000002'
        and turn_transition_id = '95000000-0000-0000-0000-000000000001'
        and world_id = '92000000-0000-0000-0000-000000000001'
        and nation_id = '93000000-0000-0000-0000-000000000001'
        and settlement_id = '94000000-0000-0000-0000-000000000001'
        and citizen_id = '97000000-0000-0000-0000-000000000001'
        and resource_id = '98000000-0000-0000-0000-000000000001'
        and log_category = 'settlement.ready_reset'
        and payload_jsonb = '{"settlementName":"Turn Log Settlement"}'::jsonb
    ),
    'owner can read the inserted turn log entry payload and entity references'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can write logs in administered worlds.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
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
    'world admin can insert turn log entries in administered worlds'
  );

select
  ok (
    exists (
      select
        1
      from
        public.turn_log_entries
      where
        id = '96000000-0000-0000-0000-000000000003'
        and payload_jsonb = '{}'::jsonb
    ),
    'turn log entries default to an empty JSON payload'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and write logs across worlds.
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
        id in (
          '96000000-0000-0000-0000-000000000001',
          '96000000-0000-0000-0000-000000000002',
          '96000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read turn log entries across worlds'
  );

select
  lives_ok (
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
    'super admin can insert turn log entries in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS
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
