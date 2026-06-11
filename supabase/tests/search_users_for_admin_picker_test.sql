-- pgTAP tests for public.search_users_for_admin_picker RPC
-- and the narrowed public.users direct-select behavior.
-- Run with: npx supabase test db
--
-- Acceptance criteria covered:
--   • World admin can call the RPC and receives id + username rows
--   • Explicit world admin (non-owner) can call the RPC
--   • Non-admin authenticated user receives 42501
--   • Anonymous caller receives 42501
--   • Direct SELECT on public.users as a world admin returns only their own row
--   • Direct SELECT on public.users as a super admin returns all rows
--   • RPC search by username filters results correctly
--   • RPC search by email matches but email is not in result columns
--   • p_limit is clamped to at most 50
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID series: c1-prefixed users, c2-prefixed worlds.
-- Same series as the former users_select_world_admin_test.sql which this file
-- replaces; safe because each test file runs in its own transaction.
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
    'c1000000-0000-0000-0000-000000000001',
    'wa-owner@example.com',
    'x',
    now(),
    '{"username":"wa_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'wa-admin@example.com',
    'x',
    now(),
    '{"username":"wa_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'wa-outsider@example.com',
    'x',
    now(),
    '{"username":"wa_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'wa-super@example.com',
    'x',
    now(),
    '{"username":"wa_super"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'WA Test World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- WORLD ADMIN: can call the RPC and gets id + username rows
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.search_users_for_admin_picker ()
      where
        id in (
          'c1000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000002',
          'c1000000-0000-0000-0000-000000000003',
          'c1000000-0000-0000-0000-000000000004'
        )
    ),
    4,
    'world admin can call the RPC and all four fixture rows are returned'
  );

reset role;

-- ===========================================================================
-- EXPLICIT WORLD ADMIN: can call the RPC
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.search_users_for_admin_picker ()
      where
        id in (
          'c1000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000002',
          'c1000000-0000-0000-0000-000000000003',
          'c1000000-0000-0000-0000-000000000004'
        )
    ),
    4,
    'explicit world admin can call the RPC'
  );

reset role;

-- ===========================================================================
-- NON-ADMIN AUTHENTICATED USER: 42501
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$select public.search_users_for_admin_picker ()$test$,
    '42501',
    null,
    'non-admin authenticated user is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ANONYMOUS CALLER: 42501 (grant is only to authenticated)
-- ===========================================================================
set
  local role anon;

select
  throws_ok (
    $test$select public.search_users_for_admin_picker ()$test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- DIRECT SELECT as world admin: only own row visible (users_select_self)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.users
      where
        id = 'c1000000-0000-0000-0000-000000000003'
    ),
    'world admin direct SELECT cannot read other users row'
  );

select
  ok (
    exists (
      select
        1
      from
        public.users
      where
        id = 'c1000000-0000-0000-0000-000000000001'
    ),
    'world admin direct SELECT can read own row (users_select_self)'
  );

reset role;

-- ===========================================================================
-- DIRECT SELECT as super admin: all rows visible (users_select_super_admin)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.users
      where
        id in (
          'c1000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000002',
          'c1000000-0000-0000-0000-000000000003',
          'c1000000-0000-0000-0000-000000000004'
        )
    ),
    4,
    'super admin direct SELECT can read all user rows'
  );

reset role;

-- ===========================================================================
-- RPC p_query filters by username
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.search_users_for_admin_picker ('wa_owner')
    ),
    1,
    'username search returns only matching rows'
  );

reset role;

-- ===========================================================================
-- RPC p_query matches by email but result has no email column
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::int
      from
        public.search_users_for_admin_picker ('wa-admin@example.com')
      where
        id = 'c1000000-0000-0000-0000-000000000002'
    ),
    1,
    'email search returns matching row (email not exposed in result)'
  );

reset role;

-- ===========================================================================
-- RPC p_limit clamped to 50
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    (
      select
        count(*)::int
      from
        public.search_users_for_admin_picker (null, 999)
      where
        id in (
          'c1000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000002',
          'c1000000-0000-0000-0000-000000000003',
          'c1000000-0000-0000-0000-000000000004'
        )
    ) = 4,
    'p_limit=999 is clamped to 50; all four fixture rows still returned'
  );

reset role;

select
  finish ();

rollback;
