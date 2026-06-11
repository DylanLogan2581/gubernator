-- pgTAP tests for worlds INSERT RLS policy.
-- The worlds_insert_authenticated policy requires is_super_admin().
-- Non-super-admin callers are denied with 42501.
-- Verify that create_world() RPC enforces the same requirement.
-- Run with: npx supabase test db
begin;

select
  plan (6);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges:
--   aa1xxxxx = users          aa2xxxxx = worlds
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
    'aa100000-0000-0000-0000-000000000001',
    'wi-superadmin@example.com',
    'x',
    now(),
    '{"username":"wi_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'aa100000-0000-0000-0000-000000000002',
    'wi-user@example.com',
    'x',
    now(),
    '{"username":"wi_user"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'aa100000-0000-0000-0000-000000000001';

-- Debug: verify user is set up correctly
select
  ok (
    (
      select
        count(*)::integer = 1
      from
        public.users
      where
        id = 'aa100000-0000-0000-0000-000000000001'
        and is_super_admin = true
        and status = 'active'
    ),
    'user aa1 is set up as super-admin with active status'
  );

-- ===========================================================================
-- Non-super-admin caller — direct INSERT rejected with 42501
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $$
      insert into public.worlds (name, visibility) values ('Unauthorized World', 'private');
    $$,
    '42501',
    null,
    'direct INSERT into worlds rejected with 42501 for non-super-admin'
  );

-- ===========================================================================
-- Non-super-admin caller — create_world() RPC rejected with 42501
-- ===========================================================================
select
  throws_ok (
    $$
      select public.create_world ('Unauthorized RPC World', 'private')
    $$,
    '42501',
    null,
    'create_world() RPC rejected with 42501 for non-super-admin'
  );

-- ===========================================================================
-- Super-admin caller — create_world() RPC succeeds
-- ===========================================================================
set
  local "request.jwt.claims" = '{"sub":"aa100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $$
      select public.create_world ('SA RPC Created World', 'public')
    $$,
    'super-admin create_world() RPC succeeds'
  );

-- ===========================================================================
-- Super-admin caller — create_world() auto-inserts creator into world_admins
-- ===========================================================================
select
  ok (
    (
      select
        count(*)::integer > 0
      from
        public.world_admins wa
      where
        wa.user_id = 'aa100000-0000-0000-0000-000000000001'
    ),
    'super-admin create_world() RPC auto-inserts creator into world_admins'
  );

-- ===========================================================================
-- Super-admin caller — direct INSERT succeeds with world_admins auto-insert
-- ===========================================================================
select
  lives_ok (
    $$
      insert into public.worlds (name, visibility) values ('SA Direct Insert World', 'private');
    $$,
    'super-admin direct INSERT into worlds succeeds'
  );

reset role;

select
  *
from
  finish ();

rollback;
