-- pgTAP tests for auth_user_sync migration.
-- Run with: npx supabase test db
--
-- Tests verify that:
--   1. Inserting into auth.users creates a matching public.users row.
--   2. The created row has the correct id, email, and status.
--   3. Username is derived from raw_user_meta_data when provided.
--   4. Username falls back to 'user_<first-8-chars-of-id>' when not provided.
--   5. Updating auth.users email propagates to public.users.
--   6. Duplicate inserts (on conflict) are handled without error.
begin;

select
  plan (9);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUIDs are hardcoded to avoid psql \set metacommands which prettier rejects.
-- ---------------------------------------------------------------------------
-- Insert two test auth users directly (simulates Supabase auth sign-up).
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
    '10000000-0000-0000-0000-000000000001',
    'alice@example.com',
    'x',
    now(),
    '{"username": "alice"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'bob@example.com',
    'x',
    now(),
    '{}'::jsonb,
    now(),
    now()
  );

-- ---------------------------------------------------------------------------
-- 1. Rows were created in public.users
-- ---------------------------------------------------------------------------
select
  ok (
    exists (
      select
        1
      from
        public.users
      where
        id = '10000000-0000-0000-0000-000000000001'
    ),
    'public.users row created for alice'
  );

select
  ok (
    exists (
      select
        1
      from
        public.users
      where
        id = '20000000-0000-0000-0000-000000000002'
    ),
    'public.users row created for bob'
  );

-- ---------------------------------------------------------------------------
-- 2. Email is stored correctly
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        email
      from
        public.users
      where
        id = '10000000-0000-0000-0000-000000000001'
    ),
    'alice@example.com',
    'alice email stored correctly'
  );

-- ---------------------------------------------------------------------------
-- 3. Status defaults to active
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        status
      from
        public.users
      where
        id = '10000000-0000-0000-0000-000000000001'
    ),
    'active',
    'alice status is active'
  );

-- ---------------------------------------------------------------------------
-- 4. Username from raw_user_meta_data when provided
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        username
      from
        public.users
      where
        id = '10000000-0000-0000-0000-000000000001'
    ),
    'alice',
    'alice username taken from metadata'
  );

-- ---------------------------------------------------------------------------
-- 5. Username falls back to user_<first-8-of-id> when metadata absent
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        username
      from
        public.users
      where
        id = '20000000-0000-0000-0000-000000000002'
    ),
    'user_20000000',
    'bob username is derived from id'
  );

-- ---------------------------------------------------------------------------
-- 6. Email update in auth.users propagates to public.users
-- ---------------------------------------------------------------------------
update auth.users
set
  email = 'alice-new@example.com'
where
  id = '10000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        email
      from
        public.users
      where
        id = '10000000-0000-0000-0000-000000000001'
    ),
    'alice-new@example.com',
    'alice email update propagated to public.users'
  );

-- ---------------------------------------------------------------------------
-- 7. Duplicate insert (on conflict) is a no-op
-- ---------------------------------------------------------------------------
insert into
  public.users (id, email, username, status)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'alice-new@example.com',
    'alice',
    'active'
  )
on conflict (id) do nothing;

select
  is (
    (
      select
        count(*)::int
      from
        public.users
      where
        id = '10000000-0000-0000-0000-000000000001'
    ),
    1,
    'on conflict does not create duplicate row'
  );

-- ---------------------------------------------------------------------------
-- 8. Backfill: auth user without a profile gets a row on re-run
-- ---------------------------------------------------------------------------
-- Simulate a user that exists in auth but has no profile yet.
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
    '30000000-0000-0000-0000-000000000003',
    'carol@example.com',
    'x',
    now(),
    '{}'::jsonb,
    now(),
    now()
  );

-- Delete the auto-created profile to simulate a missed trigger.
delete from public.users
where
  id = '30000000-0000-0000-0000-000000000003';

-- Re-run backfill logic.
insert into
  public.users (id, email, username, status)
select
  id,
  email,
  'user_' || substring(id::text, 1, 8),
  'active'
from
  auth.users
on conflict (id) do nothing;

select
  ok (
    exists (
      select
        1
      from
        public.users
      where
        id = '30000000-0000-0000-0000-000000000003'
    ),
    'backfill creates row for auth user missing a profile'
  );

select
  finish ();

rollback;
