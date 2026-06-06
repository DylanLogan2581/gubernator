-- pgTAP tests for superadmin_privilege_rpcs migration.
-- Run with: npx supabase test db
--
-- Covers:
--   grant_world_admin(p_user_id, p_world_id) — happy path, denied for non-superadmin
--   revoke_world_admin(p_user_id, p_world_id) — happy path, denied for non-superadmin
--   set_user_super_admin(p_user_id, p_value) — grant happy path, revoke happy path,
--                                               last-superadmin guard, denied for non-superadmin
begin;

select
  plan (13);

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
    'bb000000-0000-0000-0000-000000000001',
    'superadmin1@priv.test',
    'x',
    now(),
    '{"username":"sa_user1"}'::jsonb,
    now(),
    now()
  ),
  (
    'bb000000-0000-0000-0000-000000000002',
    'superadmin2@priv.test',
    'x',
    now(),
    '{"username":"sa_user2"}'::jsonb,
    now(),
    now()
  ),
  (
    'bb000000-0000-0000-0000-000000000003',
    'regular@priv.test',
    'x',
    now(),
    '{"username":"regular_user"}'::jsonb,
    now(),
    now()
  ),
  (
    'bb000000-0000-0000-0000-000000000004',
    'target@priv.test',
    'x',
    now(),
    '{"username":"target_user"}'::jsonb,
    now(),
    now()
  );

-- Promote two superadmins so we can test last-admin guard.
update public.users
set
  is_super_admin = true
where
  id in (
    'bb000000-0000-0000-0000-000000000001',
    'bb000000-0000-0000-0000-000000000002'
  );

-- Create a test world owned by sa_user1.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'bb100000-0000-0000-0000-000000000001',
    'Test World SA',
    'bb000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- ===========================================================================
-- grant_world_admin — happy path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.grant_world_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      'bb100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'superadmin can call grant_world_admin'
  );

reset role;

-- Verify the row was inserted.
select
  is (
    (
      select
        count(*)::int
      from
        public.world_admins
      where
        user_id = 'bb000000-0000-0000-0000-000000000004'
        and world_id = 'bb100000-0000-0000-0000-000000000001'
    ),
    1,
    'grant_world_admin inserted a world_admins row'
  );

-- Calling again is idempotent (no error).
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.grant_world_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      'bb100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'grant_world_admin is idempotent'
  );

reset role;

-- ===========================================================================
-- grant_world_admin — denied for non-superadmin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.grant_world_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      'bb100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '42501',
    null,
    'non-superadmin cannot call grant_world_admin'
  );

reset role;

-- ===========================================================================
-- revoke_world_admin — happy path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.revoke_world_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      'bb100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    'superadmin can call revoke_world_admin'
  );

reset role;

-- Verify the row was removed.
select
  is (
    (
      select
        count(*)::int
      from
        public.world_admins
      where
        user_id = 'bb000000-0000-0000-0000-000000000004'
        and world_id = 'bb100000-0000-0000-0000-000000000001'
    ),
    0,
    'revoke_world_admin removed the world_admins row'
  );

-- ===========================================================================
-- revoke_world_admin — denied for non-superadmin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.revoke_world_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      'bb100000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '42501',
    null,
    'non-superadmin cannot call revoke_world_admin'
  );

reset role;

-- ===========================================================================
-- set_user_super_admin — grant happy path
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_user_super_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      true
    )
  $test$,
    'superadmin can grant superadmin to another user'
  );

reset role;

select
  is (
    (
      select
        is_super_admin
      from
        public.users
      where
        id = 'bb000000-0000-0000-0000-000000000004'
    ),
    true,
    'set_user_super_admin set is_super_admin = true'
  );

-- ===========================================================================
-- set_user_super_admin — revoke happy path (3 superadmins present)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_user_super_admin(
      'bb000000-0000-0000-0000-000000000004'::uuid,
      false
    )
  $test$,
    'superadmin can revoke superadmin when other superadmins remain'
  );

reset role;

select
  is (
    (
      select
        is_super_admin
      from
        public.users
      where
        id = 'bb000000-0000-0000-0000-000000000004'
    ),
    false,
    'set_user_super_admin set is_super_admin = false'
  );

-- ===========================================================================
-- set_user_super_admin — last-superadmin guard
-- ===========================================================================
-- Demote every superadmin except sa_user1, leaving it as the sole superadmin.
-- This includes both the test fixture user2 and any seed/existing superadmins.
update public.users
set
  is_super_admin = false
where
  id != 'bb000000-0000-0000-0000-000000000001'
  and is_super_admin = true;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_user_super_admin(
      'bb000000-0000-0000-0000-000000000001'::uuid,
      false
    )
  $test$,
    'P0001',
    'cannot remove the last remaining superadmin',
    'cannot remove the last remaining superadmin'
  );

reset role;

-- ===========================================================================
-- set_user_super_admin — denied for non-superadmin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_user_super_admin(
      'bb000000-0000-0000-0000-000000000003'::uuid,
      true
    )
  $test$,
    '42501',
    null,
    'non-superadmin cannot call set_user_super_admin'
  );

reset role;

select
  finish ();

rollback;
