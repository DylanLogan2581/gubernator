-- pgTAP tests for the users_select_world_admin RLS policy.
-- Run with: npx supabase test db
--
-- Acceptance criteria covered:
--   • World owner can read all active user rows (new behavior)
--   • Explicit world admin (non-owner) can read all active user rows (new behavior)
--   • Outsider cannot read other users' rows (existing behavior preserved)
--   • Outsider can still read their own row via users_select_self (unchanged)
--   • Suspended world owner is denied — is_any_world_admin wraps is_active_app_user
--   • Suspended explicit world admin is denied by the same path
--   • Super admin behavior is unchanged (reads all via users_select_super_admin)
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- UUIDs use c1..0X for users and c2..0X for worlds; no collision with the
-- a0/b0/d0 series used by rls_policy_overhaul_test.sql or the b1/b2 series
-- used by permission_helper_role_matrix_test.sql.
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
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'WA Test World',
    'c1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- WORLD OWNER: sees all user rows
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
    'world owner can read all user rows'
  );

reset role;

-- ===========================================================================
-- EXPLICIT WORLD ADMIN: sees all user rows
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
    'explicit world admin can read all user rows'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: sees only own row; cannot read others
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.users
      where
        id = 'c1000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read world owner row'
  );

select
  ok (
    exists (
      select
        1
      from
        public.users
      where
        id = 'c1000000-0000-0000-0000-000000000003'
    ),
    'outsider can still read own row (users_select_self unchanged)'
  );

reset role;

-- ===========================================================================
-- SUSPENDED WORLD OWNER: is_any_world_admin denies inactive users
-- ===========================================================================
update public.users
set
  status = 'suspended'
where
  id = 'c1000000-0000-0000-0000-000000000001';

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
    'suspended world owner cannot read other user rows'
  );

reset role;

update public.users
set
  status = 'active'
where
  id = 'c1000000-0000-0000-0000-000000000001';

-- ===========================================================================
-- SUSPENDED EXPLICIT WORLD ADMIN: denied
-- ===========================================================================
update public.users
set
  status = 'suspended'
where
  id = 'c1000000-0000-0000-0000-000000000002';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.users
      where
        id = 'c1000000-0000-0000-0000-000000000001'
    ),
    'suspended explicit world admin cannot read other user rows'
  );

reset role;

update public.users
set
  status = 'active'
where
  id = 'c1000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- SUPER ADMIN: behavior unchanged, can read all user rows
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
    'super admin can read all user rows (unchanged)'
  );

reset role;

select
  finish ();

rollback;
