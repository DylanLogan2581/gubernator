-- pgTAP tests for restrict_worlds_delete_to_super_admin migration.
-- After dropping worlds_delete_owner, only super admins may DELETE world rows
-- directly via the table API.  Owners and explicit world admins are silently
-- denied (0 rows affected) by the remaining worlds_delete_super_admin policy.
-- Run with: npx supabase test db
--
-- Covers:
--   • World owner cannot delete their own world via table-API DELETE.
--   • World admin cannot delete an administered world via table-API DELETE.
--   • Super admin can delete via table-API DELETE (worlds_delete_super_admin).
--   • hard_delete_world RPC still works for super admins (regression guard).
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all e4-prefixed, unique to this file):
--   e4100000-xxxx = users          e4200000-xxxx = worlds
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
    'e4100000-0000-0000-0000-000000000001',
    'e4-superadmin@example.com',
    'x',
    now(),
    '{"username":"e4_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e4100000-0000-0000-0000-000000000002',
    'e4-owner@example.com',
    'x',
    now(),
    '{"username":"e4_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e4100000-0000-0000-0000-000000000003',
    'e4-admin@example.com',
    'x',
    now(),
    '{"username":"e4_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e4100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e4200000-0000-0000-0000-000000000001',
    'E4 Owner Delete World',
    'private',
    'active'
  ),
  (
    'e4200000-0000-0000-0000-000000000002',
    'E4 Admin Delete World',
    'private',
    'active'
  ),
  (
    'e4200000-0000-0000-0000-000000000003',
    'E4 Super Admin Delete World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e4200000-0000-0000-0000-000000000002',
    'e4100000-0000-0000-0000-000000000003'
  );

-- ===========================================================================
-- OWNER: cannot delete their own world via table-API DELETE
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4100000-0000-0000-0000-000000000002","role":"authenticated"}';

delete from public.worlds
where
  id = 'e4200000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e4200000-0000-0000-0000-000000000001'
    ),
    'world owner cannot delete their own world via table-API DELETE (row unchanged)'
  );

-- ===========================================================================
-- WORLD ADMIN: cannot delete an administered world via table-API DELETE
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4100000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.worlds
where
  id = 'e4200000-0000-0000-0000-000000000002';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = 'e4200000-0000-0000-0000-000000000002'
    ),
    'world admin cannot delete an administered world via table-API DELETE (row unchanged)'
  );

-- ===========================================================================
-- SUPER ADMIN: can delete via table-API DELETE (worlds_delete_super_admin)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      delete from public.worlds
      where id = 'e4200000-0000-0000-0000-000000000003'
    $test$,
    'super admin can delete a world via table-API DELETE'
  );

reset role;

select
  ok (
    not exists (
      select
        1
      from
        public.worlds
      where
        id = 'e4200000-0000-0000-0000-000000000003'
    ),
    'world row is gone after super admin table-API DELETE'
  );

-- ===========================================================================
-- SUPER ADMIN: hard_delete_world RPC still works (regression guard)
-- ===========================================================================
update public.worlds
set
  is_trashed = true
where
  id = 'e4200000-0000-0000-0000-000000000002';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e4100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
      select public.hard_delete_world ('e4200000-0000-0000-0000-000000000002'::uuid)
    $test$,
    'super admin hard_delete_world RPC still works after policy change'
  );

reset role;

select
  *
from
  finish ();

rollback;
