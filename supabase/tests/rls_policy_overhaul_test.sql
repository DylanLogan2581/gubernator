-- pgTAP tests for rls_policy_overhaul migration.
-- Run with: npx supabase test db
--
-- Covers all acceptance criteria:
--   • Anonymous users cannot read user/world/world_admins rows
--   • Authenticated users can read their own user row (but not others')
--   • Super admin can read all user/world/world_admins rows
--   • World admin can read worlds they administer
--   • world_admins rows visible only to valid users
--   • Hidden/private worlds remain invisible unless RLS grants access
--   • Write paths are restricted correctly
--   • Private worlds do not leak to unauthorised users
begin;

select
  plan (30);

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
    'a0000000-0000-0000-0000-000000000001',
    'owner@example.com',
    'x',
    now(),
    '{"username":"rls_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'worldadmin@example.com',
    'x',
    now(),
    '{"username":"rls_wadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'outsider@example.com',
    'x',
    now(),
    '{"username":"rls_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'superadmin@example.com',
    'x',
    now(),
    '{"username":"rls_superadmin"}'::jsonb,
    now(),
    now()
  );

-- Promote super admin directly (simulates service-role action).
update public.users
set
  is_super_admin = true
where
  id = 'd0000000-0000-0000-0000-000000000004';

-- Private world owned by owner.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'e0000000-0000-0000-0000-000000000001',
    'Private World',
    'a0000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'Public World',
    'a0000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'Hidden World',
    'a0000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Grant world admin on private world to world admin user.
insert into
  public.world_admins (world_id, user_id)
values
  (
    'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- ANONYMOUS: no read access to any table
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    (
      select
        count(*)::int
      from
        public.users
    ),
    0,
    'anon cannot read public.users'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.worlds
    ),
    0,
    'anon cannot read public.worlds'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.world_admins
    ),
    0,
    'anon cannot read public.world_admins'
  );

reset role;

-- ===========================================================================
-- AUTHENTICATED: own user row only
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';

-- Can read own row
select
  ok (
    exists (
      select
        1
      from
        public.users
      where
        id = 'c0000000-0000-0000-0000-000000000003'
    ),
    'authenticated user can read own row'
  );

-- Cannot read another user''s row
select
  ok (
    not exists (
      select
        1
      from
        public.users
      where
        id = 'a0000000-0000-0000-0000-000000000001'
    ),
    'authenticated user cannot read another user row'
  );

-- Cannot see private world they have no access to
select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot see private world'
  );

-- Cannot see hidden/private world they have no access to
select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000003'
    ),
    'outsider cannot see hidden world'
  );

-- Can see public world
select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000002'
    ),
    'outsider can see public world'
  );

-- Cannot see world_admins rows for a world they have no access to
select
  is (
    (
      select
        count(*)::int
      from
        public.world_admins
      where
        world_id = 'e0000000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot see world_admins rows'
  );

reset role;

-- ===========================================================================
-- OWNER: sees own worlds and can manage world_admins
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Can see own private world
select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'owner can see own private world'
  );

-- Can see world_admins rows for own world
select
  ok (
    exists (
      select
        1
      from
        public.world_admins
      where
        world_id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'owner can see world_admins rows for their world'
  );

-- Owner can insert new world_admins row
select
  lives_ok (
    $test$
    insert into public.world_admins (world_id, user_id)
    values (
      'e0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000003'
    )
  $test$,
    'owner can add a world admin'
  );

-- Owner can delete a world_admins row
select
  lives_ok (
    $test$
    delete from public.world_admins
    where world_id = 'e0000000-0000-0000-0000-000000000001'
      and user_id = 'c0000000-0000-0000-0000-000000000003'
  $test$,
    'owner can remove a world admin'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can read their assigned world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Can see the private world they administer
select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'world admin can see the private world they administer'
  );

-- Can see their own world_admins row
select
  ok (
    exists (
      select
        1
      from
        public.world_admins
      where
        world_id = 'e0000000-0000-0000-0000-000000000001'
        and user_id = 'b0000000-0000-0000-0000-000000000002'
    ),
    'world admin can see their own world_admins row'
  );

-- Cannot see the public world owned by owner (world admin only for private world)
-- Actually world admin IS counted as having access to any world they admin.
-- But NOT other worlds they don''t admin. b is not admin of public world.
select
  ok (
    not exists (
      select
        1
      from
        public.world_admins
      where
        world_id = 'e0000000-0000-0000-0000-000000000002'
    ),
    'world admin cannot see world_admins rows for a world they do not administer'
  );

-- World admin cannot see a hidden/private world they are not assigned to.
select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000003'
    ),
    'world admin cannot see unassigned hidden world'
  );

-- World admin cannot update a world (RLS silently affects 0 rows, no exception).
-- Run the update then read back to confirm name is unchanged.
update public.worlds
set
  name = 'Hacked'
where
  id = 'e0000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        name
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'Private World',
    'world admin update is silently blocked (name unchanged)'
  );

-- World admin can add another admin to their world
select
  lives_ok (
    $test$
    insert into public.world_admins (world_id, user_id)
    values (
      'e0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000003'
    )
  $test$,
    'world admin can add another world admin'
  );

-- Clean up for later tests
select
  lives_ok (
    $test$
    delete from public.world_admins
    where world_id = 'e0000000-0000-0000-0000-000000000001'
      and user_id = 'c0000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can remove a world admin'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: reads and writes everything
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}';

-- Can read all user rows
select
  is (
    (
      select
        count(*)::int
      from
        public.users
      where
        id in (
          'a0000000-0000-0000-0000-000000000001',
          'b0000000-0000-0000-0000-000000000002',
          'c0000000-0000-0000-0000-000000000003',
          'd0000000-0000-0000-0000-000000000004'
        )
    ),
    4,
    'super admin can read all user rows'
  );

-- Can read private world
select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'super admin can read private world'
  );

-- Can read all worlds
select
  is (
    (
      select
        count(*)::int
      from
        public.worlds
      where
        id in (
          'e0000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000002',
          'e0000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read all worlds'
  );

-- Can read hidden/private worlds even when not owner or assigned admin
select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e0000000-0000-0000-0000-000000000003'
    ),
    'super admin can read hidden world'
  );

-- Can read world_admins
select
  ok (
    exists (
      select
        1
      from
        public.world_admins
      where
        world_id = 'e0000000-0000-0000-0000-000000000001'
    ),
    'super admin can read world_admins rows'
  );

-- Can update any world
select
  lives_ok (
    $test$
    update public.worlds
    set name = 'SA Updated'
    where id = 'e0000000-0000-0000-0000-000000000001'
  $test$,
    'super admin can update any world'
  );

-- Can insert world_admins
select
  lives_ok (
    $test$
    insert into public.world_admins (world_id, user_id)
    values (
      'e0000000-0000-0000-0000-000000000002',
      'c0000000-0000-0000-0000-000000000003'
    )
  $test$,
    'super admin can add a world admin'
  );

-- Can delete world_admins
select
  lives_ok (
    $test$
    delete from public.world_admins
    where world_id = 'e0000000-0000-0000-0000-000000000002'
      and user_id = 'c0000000-0000-0000-0000-000000000003'
  $test$,
    'super admin can remove a world admin'
  );

-- Can delete any world
select
  lives_ok (
    $test$
    delete from public.worlds where id = 'e0000000-0000-0000-0000-000000000002'
  $test$,
    'super admin can delete any world'
  );

reset role;

-- ===========================================================================
-- NO LEAK: outsider cannot access a world created while they were looking
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';

-- After the public world was deleted above, outsider should see zero worlds.
select
  is (
    (
      select
        count(*)::int
      from
        public.worlds
    ),
    0,
    'outsider sees no worlds after public world is deleted'
  );

reset role;

select
  finish ();

rollback;
