-- pgTAP tests for public.event_groups RLS policies.
-- Run with: npx supabase test db
--
-- Policies under test:
--   event_groups_select_world_access  — current_user_has_world_access(world_id)
--   event_groups_insert_world_admin   — is_world_admin(world_id) OR is_super_admin()
--   event_groups_update_world_admin   — is_world_admin(world_id) OR is_super_admin()
--   event_groups_delete_world_admin   — is_world_admin(world_id) OR is_super_admin()
--
-- Matrix:
--   • anon                        — no read, no write
--   • authenticated non-member    — no read (no world access), no write
--   • authenticated member (PC)   — read only (has player character in world)
--   • world admin (A)             — full read+write in world-A, blocked from world-B
--   • super admin                 — full read+write across worlds
--
-- UUID ranges (all f1-prefixed, unique to this file):
--   f1100000-… = users    f1200000-… = worlds
--   f1300000-… = event_groups    f1150000-… = citizens
begin;

select
  plan (19);

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
    'f1100000-0000-0000-0000-000000000001',
    'eg-superadmin@example.com',
    'x',
    now(),
    '{"username":"eg_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000002',
    'eg-admin-a@example.com',
    'x',
    now(),
    '{"username":"eg_admin_a"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000003',
    'eg-outsider@example.com',
    'x',
    now(),
    '{"username":"eg_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1100000-0000-0000-0000-000000000004',
    'eg-member@example.com',
    'x',
    now(),
    '{"username":"eg_member"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'f1100000-0000-0000-0000-000000000001';

-- World A: admin-a and member have access; world B: outsider-admin for cross-world guard
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f1200000-0000-0000-0000-000000000001',
    'EG World A',
    'private',
    'active'
  ),
  (
    'f1200000-0000-0000-0000-000000000002',
    'EG World B',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f1200000-0000-0000-0000-000000000001',
    'f1100000-0000-0000-0000-000000000002'
  ),
  -- outsider is admin of world-B only (for cross-world guard tests)
  (
    'f1200000-0000-0000-0000-000000000002',
    'f1100000-0000-0000-0000-000000000003'
  );

-- Member has a player character in world-A (grants SELECT via world_access)
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'f1150000-0000-0000-0000-000000000001',
    'f1200000-0000-0000-0000-000000000001',
    'player_character',
    'EGMember',
    'alive',
    'f1100000-0000-0000-0000-000000000004'
  );

-- Event groups in World A
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'f1300000-0000-0000-0000-000000000001',
    'f1200000-0000-0000-0000-000000000001',
    'Group A1',
    0
  ),
  (
    'f1300000-0000-0000-0000-000000000002',
    'f1200000-0000-0000-0000-000000000001',
    'Group A2',
    0
  );

-- Event group in World B
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'f1300000-0000-0000-0000-000000000003',
    'f1200000-0000-0000-0000-000000000002',
    'Group B1',
    0
  );

-- ===========================================================================
-- ANONYMOUS: no read, no write
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
        public.event_groups
    ),
    0,
    'anon cannot read event_groups'
  );

select
  throws_ok (
    $test$
    insert into public.event_groups (world_id, name)
    values ('f1200000-0000-0000-0000-000000000001', 'Anon Insert')
  $test$,
    '42501',
    null,
    'anon cannot insert event_groups'
  );

reset role;

-- ===========================================================================
-- NON-MEMBER outsider: authenticated but no world access in world-A
-- (note: outsider IS admin of world-B, but has no access to world-A)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        world_id = 'f1200000-0000-0000-0000-000000000001'
    ),
    0,
    'non-member cannot read event_groups in world without access'
  );

select
  throws_ok (
    $test$
    insert into public.event_groups (world_id, name)
    values ('f1200000-0000-0000-0000-000000000001', 'Outsider Insert')
  $test$,
    '42501',
    null,
    'non-member cannot insert event_groups into inaccessible world'
  );

reset role;

-- ===========================================================================
-- MEMBER (player character in world-A): SELECT only, no write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        world_id = 'f1200000-0000-0000-0000-000000000001'
    ),
    2,
    'member with PC can read event_groups in their world'
  );

select
  throws_ok (
    $test$
    insert into public.event_groups (world_id, name)
    values ('f1200000-0000-0000-0000-000000000001', 'Member Insert')
  $test$,
    '42501',
    null,
    'member cannot insert event_groups (not world admin)'
  );

-- UPDATE/DELETE from non-admin are silent no-ops (USING blocks row visibility)
update public.event_groups
set
  name = 'Member Hack'
where
  id = 'f1300000-0000-0000-0000-000000000001';

delete from public.event_groups
where
  id = 'f1300000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.event_groups
      where
        id = 'f1300000-0000-0000-0000-000000000001'
    ),
    'Group A1',
    'member cannot update event_groups (row unchanged)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        id = 'f1300000-0000-0000-0000-000000000001'
    ),
    1,
    'member cannot delete event_groups (row still exists)'
  );

-- ===========================================================================
-- WORLD ADMIN (A): full read+write in world-A, blocked from world-B
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        world_id = 'f1200000-0000-0000-0000-000000000001'
    ),
    2,
    'world-A admin can read event_groups in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.event_groups (id, world_id, name, created_during_turn_number)
    values (
      'f1300000-0000-0000-0000-000000000004',
      'f1200000-0000-0000-0000-000000000001',
      'Admin Insert A',
      0
    )
  $test$,
    'world-A admin can insert event_groups in administered world'
  );

select
  lives_ok (
    $test$
    update public.event_groups set name = 'Admin Updated'
    where id = 'f1300000-0000-0000-0000-000000000004'
  $test$,
    'world-A admin can update event_groups in administered world'
  );

select
  lives_ok (
    $test$
    delete from public.event_groups
    where id = 'f1300000-0000-0000-0000-000000000004'
  $test$,
    'world-A admin can delete event_groups in administered world'
  );

-- Cross-world: world-A admin blocked from writing in world-B
select
  throws_ok (
    $test$
    insert into public.event_groups (world_id, name)
    values ('f1200000-0000-0000-0000-000000000002', 'Admin Cross-World Insert')
  $test$,
    '42501',
    null,
    'world-A admin cannot insert event_groups in world-B'
  );

-- Silent no-ops across worlds
update public.event_groups
set
  name = 'Admin Hack B'
where
  id = 'f1300000-0000-0000-0000-000000000003';

delete from public.event_groups
where
  id = 'f1300000-0000-0000-0000-000000000003';

reset role;

select
  is (
    (
      select
        name
      from
        public.event_groups
      where
        id = 'f1300000-0000-0000-0000-000000000003'
    ),
    'Group B1',
    'world-A admin cannot update event_groups in world-B'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        id = 'f1300000-0000-0000-0000-000000000003'
    ),
    1,
    'world-A admin cannot delete event_groups in world-B'
  );

-- ===========================================================================
-- SUPER ADMIN: cross-world read+write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.event_groups
      where
        world_id in (
          'f1200000-0000-0000-0000-000000000001',
          'f1200000-0000-0000-0000-000000000002'
        )
    ),
    3,
    'super admin can read event_groups across worlds'
  );

select
  lives_ok (
    $test$
    insert into public.event_groups (id, world_id, name, created_during_turn_number)
    values (
      'f1300000-0000-0000-0000-000000000005',
      'f1200000-0000-0000-0000-000000000002',
      'Super Admin Insert B',
      0
    )
  $test$,
    'super admin can insert event_groups in any world'
  );

select
  lives_ok (
    $test$
    update public.event_groups set name = 'Super Admin Updated'
    where id = 'f1300000-0000-0000-0000-000000000005'
  $test$,
    'super admin can update event_groups in any world'
  );

select
  lives_ok (
    $test$
    delete from public.event_groups
    where id = 'f1300000-0000-0000-0000-000000000005'
  $test$,
    'super admin can delete event_groups in any world'
  );

reset role;

select
  *
from
  finish ();

rollback;
