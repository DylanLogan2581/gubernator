-- pgTAP tests for public.users self-service update restrictions.
-- Run with: npx supabase test db
--
-- Covers:
--   • Active authenticated users can update allowed profile fields.
--   • Browser-authenticated users cannot change system-owned user fields.
--   • Email continues to sync from auth.users.
--   • Suspended/deleted users cannot reactivate themselves.
begin;

select
  plan (12);

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
    '41000000-0000-0000-0000-000000000001',
    'profile-active@example.com',
    'x',
    now(),
    '{"username":"profile_active"}'::jsonb,
    now(),
    now()
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    'profile-suspended@example.com',
    'x',
    now(),
    '{"username":"profile_suspended"}'::jsonb,
    now(),
    now()
  ),
  (
    '43000000-0000-0000-0000-000000000003',
    'profile-deleted@example.com',
    'x',
    now(),
    '{"username":"profile_deleted"}'::jsonb,
    now(),
    now()
  );

-- Simulates a trusted administrative path.
update public.users
set
  status = case
    when id = '42000000-0000-0000-0000-000000000002' then 'suspended'
    when id = '43000000-0000-0000-0000-000000000003' then 'deleted'
    else status
  end
where
  id in (
    '42000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000003'
  );

-- ===========================================================================
-- ACTIVE USER: allowed and forbidden self-service updates
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    update public.users
    set username = 'profile_active_renamed'
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    'active authenticated user can update username'
  );

reset role;

select
  is (
    (
      select
        username
      from
        public.users
      where
        id = '41000000-0000-0000-0000-000000000001'
    ),
    'profile_active_renamed',
    'username update is persisted'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.users
    set status = 'suspended'
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    'forbidden: authenticated users may update only self-service profile fields',
    'authenticated user cannot change status'
  );

select
  throws_ok (
    $test$
    update public.users
    set email = 'attacker@example.com'
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    'forbidden: authenticated users may update only self-service profile fields',
    'authenticated user cannot change email'
  );

select
  throws_ok (
    $test$
    update public.users
    set created_at = created_at - interval '1 day'
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    'forbidden: authenticated users may update only self-service profile fields',
    'authenticated user cannot change created_at'
  );

select
  throws_ok (
    $test$
    update public.users
    set updated_at = updated_at - interval '1 day'
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    'forbidden: authenticated users may update only self-service profile fields',
    'authenticated user cannot write updated_at'
  );

select
  throws_ok (
    $test$
    update public.users
    set id = '41000000-0000-0000-0000-000000000099'
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    'forbidden: authenticated users may update only self-service profile fields',
    'authenticated user cannot change id'
  );

select
  throws_ok (
    $test$
    update public.users
    set is_super_admin = true
    where id = '41000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    'forbidden: is_super_admin may only be changed by a privileged caller',
    'authenticated user cannot self-elevate is_super_admin'
  );

reset role;

-- Auth remains the email source of truth.
update auth.users
set
  email = 'profile-active-renamed@example.com'
where
  id = '41000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        email
      from
        public.users
      where
        id = '41000000-0000-0000-0000-000000000001'
    ),
    'profile-active-renamed@example.com',
    'public.users email syncs from auth.users'
  );

-- ===========================================================================
-- SUSPENDED/DELETED USERS: cannot reactivate themselves
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"42000000-0000-0000-0000-000000000002","role":"authenticated"}';

update public.users
set
  status = 'active'
where
  id = '42000000-0000-0000-0000-000000000002';

reset role;

select
  is (
    (
      select
        status
      from
        public.users
      where
        id = '42000000-0000-0000-0000-000000000002'
    ),
    'suspended',
    'suspended user cannot reactivate themselves'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"43000000-0000-0000-0000-000000000003","role":"authenticated"}';

update public.users
set
  status = 'active'
where
  id = '43000000-0000-0000-0000-000000000003';

reset role;

select
  is (
    (
      select
        status
      from
        public.users
      where
        id = '43000000-0000-0000-0000-000000000003'
    ),
    'deleted',
    'deleted user cannot reactivate themselves'
  );

-- Privileged status changes still work outside the browser-authenticated path.
update public.users
set
  status = 'suspended'
where
  id = '41000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        status
      from
        public.users
      where
        id = '41000000-0000-0000-0000-000000000001'
    ),
    'suspended',
    'privileged caller can change account status'
  );

select
  finish ();

rollback;
