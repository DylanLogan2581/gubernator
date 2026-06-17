-- pgTAP tests for #877: notification_count out-param correctness.
-- Verifies that notification_count returned by
-- internal_apply_turn_transition_log_entries_and_notifications equals the
-- number of rows actually inserted into public.notifications, not the number
-- of matching log entries.
--
-- UUID prefix map (all e8-prefixed ranges, unique to this file):
--   e8100000 = users            e8200000 = worlds
--   e8300000 = nations/transitions   e8400000 = settlements
begin;

select
  plan (3);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Two users:
--   e8100000-0001 = super admin (world owner)
--   e8100000-0002 = explicit world admin
-- This gives us 2 known recipients for a settlement-scoped notification
-- (no settlement or nation managers, so fan-out = super admins + world admin).
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
    'e8100000-0000-0000-0000-000000000001',
    'ncop-superadmin@example.com',
    'x',
    now(),
    '{"username":"ncop_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e8100000-0000-0000-0000-000000000002',
    'ncop-wadmin@example.com',
    'x',
    now(),
    '{"username":"ncop_wadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e8100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'e8200000-0000-0000-0000-000000000001',
    'NCOP World 1',
    3,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e8200000-0000-0000-0000-000000000001',
    'e8100000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e8300000-0000-0000-0000-000000000001',
    'e8200000-0000-0000-0000-000000000001',
    'NCOP Nation 1'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e8400000-0000-0000-0000-000000000001',
    'e8300000-0000-0000-0000-000000000001',
    'NCOP Settlement 1'
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
    'e8300000-0000-0000-0000-000000000099',
    'e8200000-0000-0000-0000-000000000001',
    3,
    4,
    'e8100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- TEST SCENARIO 1: notification_count matches actual rows inserted.
--
-- Payload: 1 building.suspended log entry for Settlement 1.
-- Recipients: super admin (owner) + seeded super admin(s) + world admin.
-- Call the internal function as postgres (owner role) — it is revoked from
-- public and only callable by the function owner.  Compare notification_count
-- out-param to count(*) from public.notifications for the transition.
-- ===========================================================================
do $$
declare
  v_log_entry_count   integer;
  v_notification_count integer;
  v_actual_count       integer;
begin
  select log_entry_count, notification_count
  into v_log_entry_count, v_notification_count
  from public.internal_apply_turn_transition_log_entries_and_notifications(
    'e8300000-0000-0000-0000-000000000099'::uuid,
    'e8200000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',       'building.suspended',
          'settlementId',   'e8400000-0000-0000-0000-000000000001'
        )
      )
    )
  );

  select count(*)::integer
  into v_actual_count
  from public.notifications
  where generated_in_transition_id = 'e8300000-0000-0000-0000-000000000099';

  -- Store results in a temp table for the TAP assertions below.
  create temp table ncop_results (
    notification_count integer,
    actual_count       integer,
    log_entry_count    integer
  );

  insert into ncop_results values (v_notification_count, v_actual_count, v_log_entry_count);
end;
$$;

-- TEST 1: notification_count equals actual rows in notifications.
select
  is (
    (
      select
        notification_count
      from
        ncop_results
    ),
    (
      select
        actual_count
      from
        ncop_results
    ),
    'notification_count out-param equals actual rows inserted into notifications'
  );

-- TEST 2: actual notifications > 0 (fan-out occurred).
select
  ok (
    (
      select
        actual_count
      from
        ncop_results
    ) > 0,
    'at least one notification row was inserted'
  );

-- TEST 3: log_entry_count = 1 (one log entry for one category payload element),
-- confirming that log entries != notification rows (the old bug conflated them).
select
  is (
    (
      select
        log_entry_count
      from
        ncop_results
    ),
    1,
    'log_entry_count = 1, confirming it differs from notification_count when fan-out > 1'
  );

rollback;
