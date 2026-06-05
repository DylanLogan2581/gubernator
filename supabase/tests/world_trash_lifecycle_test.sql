-- pgTAP tests for the world trash lifecycle RPCs:
-- create_world, trash_world, restore_world, hard_delete_world.
-- All four RPCs require is_super_admin(); non-super-admin callers receive 42501.
-- Run with: npx supabase test db
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all wl-prefixed, unique to this file):
--   wl1xxxxx = users          wl2xxxxx = worlds
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
    'wl100000-0000-0000-0000-000000000001',
    'wl-superadmin@example.com',
    'x',
    now(),
    '{"username":"wl_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'wl100000-0000-0000-0000-000000000002',
    'wl-user@example.com',
    'x',
    now(),
    '{"username":"wl_user"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'wl100000-0000-0000-0000-000000000001';

-- World for trash / restore tests.
insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'wl200000-0000-0000-0000-000000000001',
    'WL Lifecycle World',
    'wl100000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

-- Pre-trashed world for hard_delete happy-path and denied tests.
insert into
  public.worlds (
    id,
    name,
    owner_id,
    visibility,
    status,
    is_trashed
  )
values
  (
    'wl200000-0000-0000-0000-000000000002',
    'WL Trashed World',
    'wl100000-0000-0000-0000-000000000001',
    'private',
    'active',
    true
  );

-- ===========================================================================
-- Super-admin caller — happy-path tests
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"wl100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- create_world — returns a row with the supplied name
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        w.name
      from
        public.create_world ('WL Created World', 'public') as w
    ),
    'WL Created World',
    'create_world returns a row with the supplied name'
  );

-- ---------------------------------------------------------------------------
-- trash_world — sets is_trashed = true
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        w.is_trashed
      from
        public.trash_world ('wl200000-0000-0000-0000-000000000001') as w
    ),
    true,
    'trash_world sets is_trashed = true on the returned row'
  );

-- ---------------------------------------------------------------------------
-- trash_world — idempotent when world is already trashed
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        w.is_trashed
      from
        public.trash_world ('wl200000-0000-0000-0000-000000000001') as w
    ),
    true,
    'trash_world is idempotent when world is already trashed'
  );

-- ---------------------------------------------------------------------------
-- restore_world — clears is_trashed
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        w.is_trashed
      from
        public.restore_world ('wl200000-0000-0000-0000-000000000001') as w
    ),
    false,
    'restore_world sets is_trashed = false on the returned row'
  );

-- ---------------------------------------------------------------------------
-- hard_delete_world — P0001 when world is not trashed
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $$
      select public.hard_delete_world ('wl200000-0000-0000-0000-000000000001')
    $$,
    'P0001',
    null,
    'hard_delete_world raises P0001 when world is not trashed'
  );

-- ===========================================================================
-- Non-super-admin caller — 42501 for all four RPCs
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"wl100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $$
      select public.create_world ('Unauthorized World')
    $$,
    '42501',
    null,
    'create_world raises 42501 for non-super-admin caller'
  );

select
  throws_ok (
    $$
      select public.trash_world ('wl200000-0000-0000-0000-000000000001')
    $$,
    '42501',
    null,
    'trash_world raises 42501 for non-super-admin caller'
  );

select
  throws_ok (
    $$
      select public.restore_world ('wl200000-0000-0000-0000-000000000001')
    $$,
    '42501',
    null,
    'restore_world raises 42501 for non-super-admin caller'
  );

select
  throws_ok (
    $$
      select public.hard_delete_world ('wl200000-0000-0000-0000-000000000002')
    $$,
    '42501',
    null,
    'hard_delete_world raises 42501 for non-super-admin caller'
  );

-- ===========================================================================
-- Null params — P0002 (super-admin caller, authorization not reached)
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"wl100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $$
      select public.trash_world (null::uuid)
    $$,
    'P0002',
    null,
    'trash_world raises P0002 for null p_world_id'
  );

select
  throws_ok (
    $$
      select public.restore_world (null::uuid)
    $$,
    'P0002',
    null,
    'restore_world raises P0002 for null p_world_id'
  );

select
  throws_ok (
    $$
      select public.hard_delete_world (null::uuid)
    $$,
    'P0002',
    null,
    'hard_delete_world raises P0002 for null p_world_id'
  );

-- ===========================================================================
-- Non-existent world id — P0002
-- ===========================================================================
select
  throws_ok (
    $$
      select public.trash_world ('00000000-0000-0000-0000-000000000000')
    $$,
    'P0002',
    null,
    'trash_world raises P0002 for non-existent world id'
  );

select
  throws_ok (
    $$
      select public.restore_world ('00000000-0000-0000-0000-000000000000')
    $$,
    'P0002',
    null,
    'restore_world raises P0002 for non-existent world id'
  );

select
  throws_ok (
    $$
      select public.hard_delete_world ('00000000-0000-0000-0000-000000000000')
    $$,
    'P0002',
    null,
    'hard_delete_world raises P0002 for non-existent world id'
  );

-- ===========================================================================
-- hard_delete_world — happy path on pre-trashed world
-- ===========================================================================
select
  is (
    (
      select
        r.id
      from
        public.hard_delete_world ('wl200000-0000-0000-0000-000000000002') as r
    ),
    'wl200000-0000-0000-0000-000000000002'::uuid,
    'hard_delete_world returns the id of the permanently deleted world'
  );

reset role;

select
  *
from
  finish ();

rollback;
