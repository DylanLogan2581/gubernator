-- pgTAP tests for public.notifications constraints and RLS.
-- Run with: npx supabase test db
begin;

select
  plan (10);

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
  );

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
  lives_ok (
    $test$
    insert into public.notifications (
      id,
      recipient_user_id,
      world_id,
      citizen_id,
      nation_id,
      settlement_id,
      event_id,
      trade_route_id,
      notification_type,
      message_text,
      generated_in_transition_id
    )
    values (
      'a6000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'a7000000-0000-0000-0000-000000000001',
      'a3000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000001',
      'a8000000-0000-0000-0000-000000000001',
      'a9000000-0000-0000-0000-000000000001',
      'turn.completed',
      'Turn 4 completed.',
      'a5000000-0000-0000-0000-000000000001'
    )
  $test$,
    'recipient can insert a transition-generated notification for an accessible world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        id = 'a6000000-0000-0000-0000-000000000001'
        and recipient_user_id = 'a1000000-0000-0000-0000-000000000001'
        and world_id = 'a2000000-0000-0000-0000-000000000001'
        and nation_id = 'a3000000-0000-0000-0000-000000000001'
        and settlement_id = 'a4000000-0000-0000-0000-000000000001'
        and generated_in_transition_id = 'a5000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and message_text = 'Turn 4 completed.'
        and is_read = false
        and generated_at is not null
    ),
    'recipient can read the inserted notification with defaults and transition reference'
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
    not exists (
      select
        1
      from
        public.notifications
      where
        id = 'a6000000-0000-0000-0000-000000000001'
    ),
    'world admin cannot read another user notification in an administered world'
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
      '',
      'Missing notification type.'
    )
  $test$,
    '23514',
    null,
    'notifications require a non-empty notification_type'
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

reset role;

rollback;
