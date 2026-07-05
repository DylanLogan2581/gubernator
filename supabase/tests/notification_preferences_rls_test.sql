-- pgTAP tests for public.notification_preferences RLS (#1028).
-- Run with: npx supabase test db
begin;

select
  plan (9);

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
    'b1000000-0000-0000-0000-000000000001',
    'notification-prefs-owner@example.com',
    'x',
    now(),
    '{"username":"notification_prefs_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'notification-prefs-outsider@example.com',
    'x',
    now(),
    '{"username":"notification_prefs_outsider"}'::jsonb,
    now(),
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
        public.notification_preferences
    ),
    0,
    'anon cannot read notification preferences'
  );

reset role;

-- ===========================================================================
-- OWNER: can insert, read, update, and delete their own preference rows.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.notification_preferences (user_id, notification_type, enabled)
    values ('b1000000-0000-0000-0000-000000000001', 'turn.completed', false)
    $test$,
    'owner can insert their own preference row'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notification_preferences
      where
        user_id = 'b1000000-0000-0000-0000-000000000001'
        and notification_type = 'turn.completed'
        and enabled = false
    ),
    'owner can read their own preference row'
  );

select
  lives_ok (
    $test$
    update public.notification_preferences
    set enabled = true
    where user_id = 'b1000000-0000-0000-0000-000000000001'
      and notification_type = 'turn.completed'
    $test$,
    'owner can update their own preference row'
  );

select
  throws_ok (
    $test$
    insert into public.notification_preferences (user_id, notification_type, enabled)
    values ('b1000000-0000-0000-0000-000000000001', 'turn.completed', false)
    $test$,
    '23505',
    null,
    'a user cannot insert a second row for the same notification type'
  );

select
  lives_ok (
    $test$
    delete from public.notification_preferences
    where user_id = 'b1000000-0000-0000-0000-000000000001'
      and notification_type = 'turn.completed'
    $test$,
    'owner can delete their own preference row'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read, insert for, update, or delete another user's rows.
-- ===========================================================================
-- Seed a row for the owner directly as postgres (bypasses RLS) so the
-- outsider-visibility assertions below have data to probe.
insert into
  public.notification_preferences (user_id, notification_type, enabled)
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'trade_proposal_received',
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.notification_preferences
      where
        user_id = 'b1000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read another user''s preference rows'
  );

select
  throws_ok (
    $test$
    insert into public.notification_preferences (user_id, notification_type, enabled)
    values ('b1000000-0000-0000-0000-000000000001', 'citizen.born', false)
    $test$,
    '42501',
    null,
    'outsider cannot insert a preference row for another user'
  );

-- RLS hides the owner's row from the outsider entirely, so an UPDATE or
-- DELETE targeting it matches zero rows instead of throwing — assert the
-- no-op via row survival rather than throws_ok.
update public.notification_preferences
set
  enabled = true
where
  user_id = 'b1000000-0000-0000-0000-000000000001'
  and notification_type = 'trade_proposal_received';

delete from public.notification_preferences
where
  user_id = 'b1000000-0000-0000-0000-000000000001'
  and notification_type = 'trade_proposal_received';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.notification_preferences
      where
        user_id = 'b1000000-0000-0000-0000-000000000001'
        and notification_type = 'trade_proposal_received'
        and enabled = false
    ),
    'owner row survives the outsider''s no-op update and delete attempts'
  );

rollback;
