-- pgTAP tests for #878: turn.completed notification emitted by the live
-- end-turn flow (§C33c added in 20260722000000_emit_turn_completed_notification).
--
-- Verifies that internal_apply_turn_transition_log_entries_and_notifications
-- inserts a turn.completed row for every active world admin and super admin,
-- and that a second call does not produce duplicate rows.
--
-- UUID prefix map (all f8-prefixed ranges, unique to this file):
--   f8100000 = users            f8200000 = worlds
--   f8300000 = transitions
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Two users:
--   f8100000-0001 = explicit world admin (not a super admin)
--   f8100000-0002 = explicit super admin (not a world admin)
-- Seeded super admin from seed.sql is also present and will receive a row.
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
    'f8100000-0000-0000-0000-000000000001',
    'tcn-wadmin@example.com',
    'x',
    now(),
    '{"username":"tcn_wadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f8100000-0000-0000-0000-000000000002',
    'tcn-superadmin@example.com',
    'x',
    now(),
    '{"username":"tcn_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f8100000-0000-0000-0000-000000000002';

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'f8200000-0000-0000-0000-000000000001',
    'TCN World 1',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f8200000-0000-0000-0000-000000000001',
    'f8100000-0000-0000-0000-000000000001'
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
    'f8300000-0000-0000-0000-000000000001',
    'f8200000-0000-0000-0000-000000000001',
    5,
    6,
    'f8100000-0000-0000-0000-000000000001',
    'running'
  );

-- ---------------------------------------------------------------------------
-- First call: capture out-params and inspect rows.
-- ---------------------------------------------------------------------------
do $$
declare
  v_log_entry_count   integer;
  v_notification_count integer;
begin
  select log_entry_count, notification_count
  into v_log_entry_count, v_notification_count
  from public.internal_apply_turn_transition_log_entries_and_notifications(
    'f8300000-0000-0000-0000-000000000001'::uuid,
    'f8200000-0000-0000-0000-000000000001'::uuid,
    '{"logEntries":[]}'::jsonb
  );

  create temp table tcn_results (
    notification_count_first  integer,
    wadmin_row_count          integer,
    superadmin_row_count      integer
  );

  insert into tcn_results (
    notification_count_first,
    wadmin_row_count,
    superadmin_row_count
  )
  values (
    v_notification_count,
    (
      select count(*)::integer
      from public.notifications
      where generated_in_transition_id = 'f8300000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and recipient_user_id = 'f8100000-0000-0000-0000-000000000001'
    ),
    (
      select count(*)::integer
      from public.notifications
      where generated_in_transition_id = 'f8300000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and recipient_user_id = 'f8100000-0000-0000-0000-000000000002'
    )
  );
end;
$$;

-- TEST 1: world admin received a turn.completed notification.
select
  is (
    (
      select
        wadmin_row_count
      from
        tcn_results
    ),
    1,
    'world admin receives a turn.completed notification'
  );

-- TEST 2: explicit super admin received a turn.completed notification.
select
  is (
    (
      select
        superadmin_row_count
      from
        tcn_results
    ),
    1,
    'super admin receives a turn.completed notification'
  );

-- TEST 3: notification_count out-param includes turn.completed rows.
select
  ok (
    (
      select
        notification_count_first
      from
        tcn_results
    ) >= 2,
    'notification_count out-param >= 2 (world admin + super admin at minimum)'
  );

-- ---------------------------------------------------------------------------
-- Second call: idempotency check (on conflict do nothing).
-- ---------------------------------------------------------------------------
do $$
declare
  v_count_before integer;
  v_count_after  integer;
begin
  select count(*)::integer
  into v_count_before
  from public.notifications
  where generated_in_transition_id = 'f8300000-0000-0000-0000-000000000001'
    and notification_type = 'turn.completed';

  perform public.internal_apply_turn_transition_log_entries_and_notifications(
    'f8300000-0000-0000-0000-000000000001'::uuid,
    'f8200000-0000-0000-0000-000000000001'::uuid,
    '{"logEntries":[]}'::jsonb
  );

  select count(*)::integer
  into v_count_after
  from public.notifications
  where generated_in_transition_id = 'f8300000-0000-0000-0000-000000000001'
    and notification_type = 'turn.completed';

  create temp table tcn_dedup (
    before_count integer,
    after_count  integer
  );
  insert into tcn_dedup values (v_count_before, v_count_after);
end;
$$;

-- TEST 4: second call does not insert duplicate turn.completed rows.
select
  is (
    (
      select
        after_count
      from
        tcn_dedup
    ),
    (
      select
        before_count
      from
        tcn_dedup
    ),
    'second call does not insert duplicate turn.completed rows'
  );

rollback;
