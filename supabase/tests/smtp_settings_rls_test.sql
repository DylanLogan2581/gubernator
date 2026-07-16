-- pgTAP tests for public.smtp_settings RLS (issue #1234).
--
-- 20261109000000_add_smtp_settings.sql creates this table with RLS enabled,
-- NO policies at all, and an explicit `revoke all ... from anon,
-- authenticated`. Unlike email_send_log (which grants super admins SELECT
-- via a policy and relies on RLS-filtering for everyone else), this table
-- has no table privileges at all for anon/authenticated: every operation
-- (including a bare SELECT) raises 42501 insufficient_privilege at the
-- grant-check layer, before RLS is even evaluated. This applies uniformly
-- to super admins too -- the password column must never reach a
-- client-readable surface, so there is no read exception for anyone.
-- All access goes through the send-email Edge Function using the
-- service_role key, which bypasses RLS entirely and is unaffected by the
-- revoke (service_role keeps its default table privileges).
--
-- RLS matrix:
--   SELECT  — no grant for any client role; anon/authenticated (incl. super
--             admin) get 42501; only service_role can read
--   INSERT  — no grant for any client role; anon/authenticated (incl. super
--             admin) get 42501; only service_role can insert
--   UPDATE  — no grant for any client role; anon/authenticated (incl. super
--             admin) get 42501; only service_role can update
--   DELETE  — no grant for any client role; anon/authenticated (incl. super
--             admin) get 42501; only service_role can delete
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all e5200000-prefixed, unique to this file):
--   e5200000 = users (super admin, non-admin)
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
    'e5200000-0000-0000-0000-000000000001',
    'ss-super-admin@example.com',
    'x',
    now(),
    '{"username":"ss_super_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e5200000-0000-0000-0000-000000000002',
    'ss-non-admin@example.com',
    'x',
    now(),
    '{"username":"ss_non_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e5200000-0000-0000-0000-000000000001';

-- Seeded directly as table owner (bypasses grants/RLS) so a row exists for
-- the read/write-denial tests below without depending on service_role insert.
insert into
  public.smtp_settings (
    host,
    port,
    username,
    password,
    admin_email,
    sender_name,
    updated_by
  )
values
  (
    'ss-fixture-host',
    587,
    'ss-fixture-user',
    'ss-fixture-pass',
    'ss-fixture@example.com',
    'ss-fixture-sender',
    'e5200000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- ANON: no read access, no write access
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$select count(*) from public.smtp_settings$test$,
    '42501',
    null,
    'anon cannot read the smtp settings'
  );

select
  throws_ok (
    $test$
    insert into public.smtp_settings (
      host, port, admin_email, sender_name
    ) values (
      'ss-anon-host', 25, 'ss-anon@example.com', 'ss-anon-sender'
    )
    $test$,
    '42501',
    null,
    'anon cannot insert an smtp settings row'
  );

reset role;

-- ===========================================================================
-- AUTHENTICATED (non-admin): no read access, no write access
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e5200000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$select count(*) from public.smtp_settings$test$,
    '42501',
    null,
    'non-admin authenticated cannot read the smtp settings'
  );

select
  throws_ok (
    $test$
    insert into public.smtp_settings (
      host, port, admin_email, sender_name
    ) values (
      'ss-nonadmin-host', 25, 'ss-nonadmin@example.com', 'ss-nonadmin-sender'
    )
    $test$,
    '42501',
    null,
    'non-admin authenticated cannot insert an smtp settings row'
  );

select
  throws_ok (
    $test$update public.smtp_settings set host = 'ss-hacked-host' where host = 'ss-fixture-host'$test$,
    '42501',
    null,
    'non-admin authenticated cannot update the smtp settings'
  );

select
  throws_ok (
    $test$delete from public.smtp_settings where host = 'ss-fixture-host'$test$,
    '42501',
    null,
    'non-admin authenticated cannot delete the smtp settings'
  );

reset role;

-- ===========================================================================
-- AUTHENTICATED (super admin): still no read or write access -- deny-all
-- applies to every client role, unlike email_send_log's read exception
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e5200000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$select count(*) from public.smtp_settings$test$,
    '42501',
    null,
    'super admin cannot read the smtp settings directly'
  );

select
  throws_ok (
    $test$
    insert into public.smtp_settings (
      host, port, admin_email, sender_name
    ) values (
      'ss-superadmin-host', 25, 'ss-superadmin@example.com', 'ss-superadmin-sender'
    )
    $test$,
    '42501',
    null,
    'super admin cannot directly insert an smtp settings row (must use service_role Edge Function)'
  );

reset role;

-- ===========================================================================
-- SERVICE_ROLE: bypasses RLS entirely; this is the only read/write path
-- ===========================================================================
set
  local role service_role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.smtp_settings
    ),
    1,
    'service_role can read the smtp settings'
  );

update public.smtp_settings
set
  port = 2525
where
  host = 'ss-fixture-host';

select
  is (
    (
      select
        port
      from
        public.smtp_settings
      where
        host = 'ss-fixture-host'
    ),
    2525,
    'service_role can update the smtp settings row'
  );

delete from public.smtp_settings
where
  host = 'ss-fixture-host';

select
  is (
    (
      select
        count(*)::integer
      from
        public.smtp_settings
      where
        host = 'ss-fixture-host'
    ),
    0,
    'service_role can delete the smtp settings row'
  );

reset role;

select
  finish ();

rollback;
