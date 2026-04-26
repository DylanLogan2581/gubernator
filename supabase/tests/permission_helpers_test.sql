-- pgTAP tests for permission_helpers migration.
-- Run with: supabase test db
--
-- Covers:
--   current_app_user_id() — returns auth.uid() for authenticated sessions
--   is_super_admin()      — false for normal users, true for flagged users
--   is_world_admin()      — false for outsiders, true for owners and admins
--   has_world_access()    — covers all access paths (public, owner, admin,
--                           super admin) and denies private worlds to others
--   Super-admin elevation guard trigger
begin;

select
  plan (17);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Three auth users: owner, admin, outsider.  Super-admin flag is set later.
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
    'aa000000-0000-0000-0000-000000000001',
    'owner@example.com',
    'x',
    now(),
    '{"username":"owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'bb000000-0000-0000-0000-000000000002',
    'admin@example.com',
    'x',
    now(),
    '{"username":"admin_user"}'::jsonb,
    now(),
    now()
  ),
  (
    'cc000000-0000-0000-0000-000000000003',
    'outsider@example.com',
    'x',
    now(),
    '{"username":"outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'dd000000-0000-0000-0000-000000000004',
    'superadmin@example.com',
    'x',
    now(),
    '{"username":"superadmin"}'::jsonb,
    now(),
    now()
  );

-- Promote the super-admin user directly (simulates service-role action).
update public.users
set
  is_super_admin = true
where
  id = 'dd000000-0000-0000-0000-000000000004';

-- Create a private world owned by owner, and a public world.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'Private World',
    'aa000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'Public World',
    'aa000000-0000-0000-0000-000000000001',
    'public',
    'active'
  );

-- Grant admin on private world to the admin user.
insert into
  public.world_admins (world_id, user_id)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'bb000000-0000-0000-0000-000000000002'
  );

-- ---------------------------------------------------------------------------
-- Helper: run a block as a given user by setting JWT claims and role.
-- ---------------------------------------------------------------------------
-- Tests use SET LOCAL so changes are scoped to the current transaction block.
-- ===========================================================================
-- current_app_user_id()
-- ===========================================================================
-- As authenticated owner
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.current_app_user_id (),
    'aa000000-0000-0000-0000-000000000001'::uuid,
    'current_app_user_id returns auth.uid for authenticated user'
  );

-- Reset to postgres role for subsequent setup steps
reset role;

-- ===========================================================================
-- is_super_admin()
-- ===========================================================================
-- Non-super-admin user
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.is_super_admin (),
    false,
    'is_super_admin returns false for a normal user'
  );

reset role;

-- Super-admin user
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.is_super_admin (),
    true,
    'is_super_admin returns true for a super-admin user'
  );

reset role;

-- ===========================================================================
-- is_world_admin()
-- ===========================================================================
-- Owner of the world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.is_world_admin ('f1000000-0000-0000-0000-000000000001'),
    true,
    'is_world_admin returns true for the world owner'
  );

reset role;

-- Explicit world admin
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.is_world_admin ('f1000000-0000-0000-0000-000000000001'),
    true,
    'is_world_admin returns true for an explicit world admin'
  );

reset role;

-- Outsider
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.is_world_admin ('f1000000-0000-0000-0000-000000000001'),
    false,
    'is_world_admin returns false for an outsider'
  );

reset role;

-- Wrong world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.is_world_admin ('f2000000-0000-0000-0000-000000000002'),
    false,
    'is_world_admin returns false when admin of a different world'
  );

reset role;

-- ===========================================================================
-- has_world_access()
-- ===========================================================================
-- Owner can access their own private world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    public.has_world_access ('f1000000-0000-0000-0000-000000000001'),
    true,
    'has_world_access returns true for the world owner (private world)'
  );

reset role;

-- Explicit admin can access the private world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"bb000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    public.has_world_access ('f1000000-0000-0000-0000-000000000001'),
    true,
    'has_world_access returns true for an explicit world admin (private world)'
  );

reset role;

-- Outsider cannot access a private world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.has_world_access ('f1000000-0000-0000-0000-000000000001'),
    false,
    'has_world_access returns false for outsider on private world'
  );

reset role;

-- Any authenticated user can access a public world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    public.has_world_access ('f2000000-0000-0000-0000-000000000002'),
    true,
    'has_world_access returns true for outsider on public world'
  );

reset role;

-- Super admin can access any world
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"dd000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    public.has_world_access ('f1000000-0000-0000-0000-000000000001'),
    true,
    'has_world_access returns true for super admin on private world they do not own'
  );

reset role;

-- ===========================================================================
-- Super-admin elevation guard
-- ===========================================================================
-- Authenticated user must not be able to set is_super_admin on their own row.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.users
    set is_super_admin = true
    where id = 'cc000000-0000-0000-0000-000000000003'
  $test$,
    '42501',
    'forbidden: is_super_admin may only be changed by a privileged caller',
    'authenticated user cannot self-elevate is_super_admin'
  );

reset role;

-- Privileged (postgres) role may change is_super_admin.
update public.users
set
  is_super_admin = true
where
  id = 'cc000000-0000-0000-0000-000000000003';

select
  is (
    (
      select
        is_super_admin
      from
        public.users
      where
        id = 'cc000000-0000-0000-0000-000000000003'
    ),
    true,
    'postgres role can set is_super_admin'
  );

-- Restore for cleanliness
update public.users
set
  is_super_admin = false
where
  id = 'cc000000-0000-0000-0000-000000000003';

-- ===========================================================================
-- Unauthenticated session
-- ===========================================================================
-- current_app_user_id returns NULL when there is no JWT sub
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    public.current_app_user_id (),
    null::uuid,
    'current_app_user_id returns NULL for unauthenticated session'
  );

reset role;

-- is_super_admin returns false when unauthenticated
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    public.is_super_admin (),
    false,
    'is_super_admin returns false for unauthenticated session'
  );

reset role;

-- has_world_access returns false for unauthenticated user on private world
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    public.has_world_access ('f1000000-0000-0000-0000-000000000001'),
    false,
    'has_world_access returns false for unauthenticated user on private world'
  );

reset role;

select
  finish ();

rollback;
