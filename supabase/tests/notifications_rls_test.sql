-- pgTAP tests for public.notifications constraints and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (18);

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
    'a1000000-0000-0000-0000-000000000001',
    'notifications-owner@example.com',
    'x',
    now(),
    '{"username":"notifications_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'notifications-admin@example.com',
    'x',
    now(),
    '{"username":"notifications_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'notifications-outsider@example.com',
    'x',
    now(),
    '{"username":"notifications_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'notifications-superadmin@example.com',
    'x',
    now(),
    '{"username":"notifications_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a1000000-0000-0000-0000-000000000004';

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
    'a2000000-0000-0000-0000-000000000001',
    'Notifications Private World',
    'a1000000-0000-0000-0000-000000000001',
    4,
    'private',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'Notifications Outsider World',
    'a1000000-0000-0000-0000-000000000003',
    2,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Notifications Nation'
  ),
  (
    'a3000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'Notifications Outsider Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    'Notifications Settlement'
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
    'a5000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    3,
    4,
    'a1000000-0000-0000-0000-000000000001',
    'completed',
    now()
  ),
  (
    'a5000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    1,
    2,
    'a1000000-0000-0000-0000-000000000003',
    'completed',
    now()
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
        public.notifications
    ),
    0,
    'anon cannot read notifications'
  );

reset role;

-- ===========================================================================
-- OWNER: current user can insert and read their own notification.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text,
      generated_in_transition_id
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      'Forged self notification.',
      'a5000000-0000-0000-0000-000000000001'
    )
  $test$,
    '42501',
    null,
    'authenticated recipients cannot insert notifications directly'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    0,
    'direct authenticated insert leaves no notification rows behind'
  );

reset role;

-- Generate the notification through the privileged path so the visibility
-- assertions below have data to read.
select
  public.advance_world_turn_if_current (
    'a2000000-0000-0000-0000-000000000001',
    4,
    'a1000000-0000-0000-0000-000000000001',
    null,
    '{
      "notificationType": "turn.completed",
      "messageText": "World advanced to turn 5."
    }'::jsonb
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and message_text = 'World advanced to turn 5.'
        and generated_in_transition_id is not null
    ),
    'owner can read their own generated turn-completed notification'
  );

select
  throws_ok (
    $test$
    update public.notifications
    set message_text = 'tampered'
    where recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'owner cannot update their own notifications directly'
  );

select
  throws_ok (
    $test$
    delete from public.notifications
    where recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'owner cannot delete their own notifications directly'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: world access does not expose another user's notifications.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        recipient_user_id = 'a1000000-0000-0000-0000-000000000002'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and message_text = 'World advanced to turn 5.'
        and generated_in_transition_id is not null
    ),
    'world admin can read their own generated notification'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.notifications
      where
        recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and message_text = 'World advanced to turn 5.'
    ),
    'world admin cannot read another user generated notification in an administered world'
  );

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      'Blocked for another recipient.'
    )
  $test$,
    '42501',
    null,
    'authenticated users cannot insert notifications for another recipient'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: notifications remain recipient-scoped even for super admins.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        recipient_user_id = 'a1000000-0000-0000-0000-000000000004'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and message_text = 'World advanced to turn 5.'
        and generated_in_transition_id is not null
    ),
    'super admin can read their own generated notification'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.notifications
      where
        recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and message_text = 'World advanced to turn 5.'
    ),
    'super admin cannot read another recipient notification row'
  );

select
  throws_ok (
    $test$
    update public.notifications
    set message_text = 'tampered'
    where recipient_user_id = 'a1000000-0000-0000-0000-000000000004'
  $test$,
    '42501',
    null,
    'super admin cannot update notifications directly'
  );

select
  throws_ok (
    $test$
    delete from public.notifications
    where recipient_user_id = 'a1000000-0000-0000-0000-000000000004'
  $test$,
    '42501',
    null,
    'super admin cannot delete notifications directly'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: recipient ownership alone does not allow inaccessible-world inserts.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000003',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      'Blocked inaccessible world.'
    )
  $test$,
    '42501',
    null,
    'recipient cannot insert notifications into inaccessible private worlds'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS
-- ===========================================================================
-- Authenticated callers can no longer insert notifications directly, so the
-- DB-level CHECK constraints are exercised as the table owner — the same
-- effective role used by the SECURITY DEFINER turn-advancement RPC.
select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text,
      generated_in_transition_id
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      'Mismatched transition.',
      'a5000000-0000-0000-0000-000000000002'
    )
  $test$,
    '23503',
    null,
    'notifications require transition and world references to match'
  );

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      nation_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'a3000000-0000-0000-0000-000000000002',
      'turn.completed',
      'Mismatched nation.'
    )
  $test$,
    '23514',
    null,
    'notifications require nation references to stay inside the notification world'
  );

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'world.unannounced',
      'Unknown notification type.'
    )
  $test$,
    '23514',
    null,
    'notification_type is constrained to the system allowlist'
  );

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      ''
    )
  $test$,
    '23514',
    null,
    'notifications require non-empty message_text'
  );

rollback;
