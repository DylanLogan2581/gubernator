-- pgTAP tests for notification mark-read RPC functions.
-- Run with: npx supabase test db
--
-- Covers:
--   • User can mark their own notification as read via mark_notification_read RPC.
--   • User cannot mark another user's notification as read (RPC enforces recipient check).
--   • User can mark all their own unread notifications as read via mark_all_notifications_read RPC.
begin;

select
  plan (4);

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
    '92000000-0000-0000-0000-000000000001',
    'user1@example.com',
    'x',
    now(),
    '{"username":"user1"}'::jsonb,
    now(),
    now()
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'user2@example.com',
    'x',
    now(),
    '{"username":"user2"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '93000000-0000-0000-0000-000000000001',
    'Test World',
    'private',
    'active'
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
    '94000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    0,
    1,
    '92000000-0000-0000-0000-000000000001',
    'completed'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000001',
    1,
    2,
    '92000000-0000-0000-0000-000000000001',
    'completed'
  );

insert into
  public.notifications (
    id,
    recipient_user_id,
    world_id,
    notification_type,
    message_text,
    is_read,
    generated_in_transition_id
  )
values
  (
    '95000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'turn.completed',
    'User 1 notification 1',
    false,
    '94000000-0000-0000-0000-000000000001'
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'turn.completed',
    'User 1 notification 2',
    false,
    '94000000-0000-0000-0000-000000000002'
  ),
  (
    '95000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000001',
    'turn.completed',
    'User 2 notification',
    false,
    '94000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- Test 1: User can mark their own notification as read
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
  select public.mark_notification_read('95000000-0000-0000-0000-000000000001'::uuid);
  $test$,
    'User can mark own notification as read via RPC'
  );

select
  is (
    (
      select
        is_read
      from
        public.notifications
      where
        id = '95000000-0000-0000-0000-000000000001'
    ),
    true,
    'User 1 notification 1 should be marked as read'
  );

-- ===========================================================================
-- Test 2: User cannot mark another user's notification as read
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- User 2 tries to mark User 1's notification as read (should fail silently)
select
  results_eq (
    $test$
  select count(*)::int from public.mark_notification_read('95000000-0000-0000-0000-000000000001'::uuid)
  $test$,
    $expected$values (0)$expected$,
    'User 2 cannot mark User 1 notification as read (RPC returns no rows)'
  );

-- ===========================================================================
-- Test 3: User can mark all their unread notifications as read
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
  select public.mark_all_notifications_read();
  $test$,
    'User can mark all notifications as read via RPC'
  );

reset role;

select
  *
from
  finish ();

rollback;
