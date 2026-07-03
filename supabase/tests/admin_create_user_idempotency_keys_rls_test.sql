-- pgTAP tests for public.admin_create_user_idempotency_keys RLS (issue #973).
--
-- 20260802000000_rls_audit_admin_idempotency_keys.sql enabled RLS on this
-- table (created without it in 20260621000000_admin_create_user_idempotency.sql,
-- leaving created-user emails fully exposed to anon/authenticated). The table
-- has exactly one policy: SELECT for authenticated super admins. There are no
-- INSERT/UPDATE/DELETE policies -- all writes go through the admin-create-user
-- Edge Function using the service_role key, which bypasses RLS entirely.
--
-- RLS matrix:
--   SELECT  — super admin only; anon and non-admin authenticated see zero rows
--   INSERT  — no policy for any client role; anon/authenticated (incl. super
--             admin) get 42501; only service_role (bypasses RLS) can insert
--   UPDATE  — no policy; anon/authenticated affect zero rows (silent no-op,
--             not an error, since RLS filters the target row before UPDATE)
--   DELETE  — no policy; same silent-no-op behavior as UPDATE
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all adf-prefixed, unique to this file):
--   adf10000 = users (super admin, non-admin)
begin;

select
  plan (11);

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
    'adf10000-0000-0000-0000-000000000001',
    'aik-super-admin@example.com',
    'x',
    now(),
    '{"username":"aik_super_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'adf10000-0000-0000-0000-000000000002',
    'aik-non-admin@example.com',
    'x',
    now(),
    '{"username":"aik_non_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'adf10000-0000-0000-0000-000000000001';

-- Seeded directly as table owner (bypasses grants/RLS) so a row exists for
-- the read/write-denial tests below without depending on service_role insert.
insert into
  public.admin_create_user_idempotency_keys (
    idempotency_key,
    caller_user_id,
    created_user_id,
    created_user_email,
    created_user_username
  )
values
  (
    'aik-fixture-key',
    'adf10000-0000-0000-0000-000000000001',
    'adf10000-0000-0000-0000-000000000003',
    'aik-created@example.com',
    'aik_created'
  );

-- ===========================================================================
-- ANON: no read access, no write access
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
        public.admin_create_user_idempotency_keys
    ),
    0,
    'anon cannot read idempotency keys'
  );

select
  throws_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'aik-anon-key',
      'adf10000-0000-0000-0000-000000000002',
      'adf10000-0000-0000-0000-000000000004',
      'aik-anon-insert@example.com',
      'aik_anon_insert'
    )
    $test$,
    '42501',
    null,
    'anon cannot insert an idempotency key'
  );

reset role;

-- ===========================================================================
-- AUTHENTICATED (non-admin): no read access, no write access
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"adf10000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.admin_create_user_idempotency_keys
    ),
    0,
    'non-admin authenticated cannot read idempotency keys'
  );

select
  throws_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'aik-nonadmin-key',
      'adf10000-0000-0000-0000-000000000002',
      'adf10000-0000-0000-0000-000000000005',
      'aik-nonadmin-insert@example.com',
      'aik_nonadmin_insert'
    )
    $test$,
    '42501',
    null,
    'non-admin authenticated cannot insert an idempotency key'
  );

-- No UPDATE/DELETE policy exists, so RLS filters the target row before the
-- write reaches it: the statement succeeds but affects zero rows (not an
-- error), same as a WHERE clause matching nothing. The row is also
-- SELECT-invisible to this role, so the verification reads below run after
-- `reset role` (as table owner, which bypasses RLS) rather than in-role.
update public.admin_create_user_idempotency_keys
set
  created_user_email = 'aik-hacked@example.com'
where
  idempotency_key = 'aik-fixture-key';

delete from public.admin_create_user_idempotency_keys
where
  idempotency_key = 'aik-fixture-key';

reset role;

select
  is (
    (
      select
        created_user_email
      from
        public.admin_create_user_idempotency_keys
      where
        idempotency_key = 'aik-fixture-key'
    ),
    'aik-created@example.com',
    'non-admin authenticated update is a no-op (RLS filters the row)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.admin_create_user_idempotency_keys
      where
        idempotency_key = 'aik-fixture-key'
    ),
    1,
    'non-admin authenticated delete is a no-op (RLS filters the row)'
  );

-- ===========================================================================
-- AUTHENTICATED (super admin): read access via policy; still no direct writes
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"adf10000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.admin_create_user_idempotency_keys
    ),
    1,
    'super admin can read idempotency keys'
  );

select
  throws_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'aik-superadmin-key',
      'adf10000-0000-0000-0000-000000000001',
      'adf10000-0000-0000-0000-000000000006',
      'aik-superadmin-insert@example.com',
      'aik_superadmin_insert'
    )
    $test$,
    '42501',
    null,
    'super admin cannot directly insert an idempotency key (must use service_role Edge Function)'
  );

reset role;

-- ===========================================================================
-- SERVICE_ROLE: bypasses RLS entirely; this is the only write path
-- ===========================================================================
set
  local role service_role;

select
  lives_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'aik-service-key',
      'adf10000-0000-0000-0000-000000000001',
      'adf10000-0000-0000-0000-000000000007',
      'aik-service@example.com',
      'aik_service'
    )
    $test$,
    'service_role can insert an idempotency key'
  );

update public.admin_create_user_idempotency_keys
set
  created_user_email = 'aik-service-updated@example.com'
where
  idempotency_key = 'aik-service-key';

select
  is (
    (
      select
        created_user_email
      from
        public.admin_create_user_idempotency_keys
      where
        idempotency_key = 'aik-service-key'
    ),
    'aik-service-updated@example.com',
    'service_role can update an idempotency key'
  );

delete from public.admin_create_user_idempotency_keys
where
  idempotency_key = 'aik-service-key';

select
  is (
    (
      select
        count(*)::integer
      from
        public.admin_create_user_idempotency_keys
      where
        idempotency_key = 'aik-service-key'
    ),
    0,
    'service_role can delete an idempotency key'
  );

reset role;

select
  finish ();

rollback;
