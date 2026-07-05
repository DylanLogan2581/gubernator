-- pgTAP tests for public.email_send_log RLS (issue #1016).
--
-- 20260822000000_add_email_send_log.sql creates this table with RLS enabled
-- from the start. The table has exactly one policy: SELECT for authenticated
-- super admins. There are no INSERT/UPDATE/DELETE policies -- all writes go
-- through the send-email Edge Function using the service_role key, which
-- bypasses RLS entirely.
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
-- UUID prefix map (all e5100000-prefixed, unique to this file):
--   e5100000 = users (super admin, non-admin)
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
    'e5100000-0000-0000-0000-000000000001',
    'esl-super-admin@example.com',
    'x',
    now(),
    '{"username":"esl_super_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e5100000-0000-0000-0000-000000000002',
    'esl-non-admin@example.com',
    'x',
    now(),
    '{"username":"esl_non_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e5100000-0000-0000-0000-000000000001';

-- Seeded directly as table owner (bypasses grants/RLS) so a row exists for
-- the read/write-denial tests below without depending on service_role insert.
insert into
  public.email_send_log (
    sender_user_id,
    recipient_spec,
    subject,
    recipient_count
  )
values
  (
    'e5100000-0000-0000-0000-000000000001',
    '{"kind":"all"}'::jsonb,
    'esl-fixture-subject',
    3
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
        public.email_send_log
    ),
    0,
    'anon cannot read the email send log'
  );

select
  throws_ok (
    $test$
    insert into public.email_send_log (
      sender_user_id, recipient_spec, subject, recipient_count
    ) values (
      'e5100000-0000-0000-0000-000000000002',
      '{"kind":"all"}'::jsonb,
      'esl-anon-insert',
      1
    )
    $test$,
    '42501',
    null,
    'anon cannot insert an email send log row'
  );

reset role;

-- ===========================================================================
-- AUTHENTICATED (non-admin): no read access, no write access
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e5100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.email_send_log
    ),
    0,
    'non-admin authenticated cannot read the email send log'
  );

select
  throws_ok (
    $test$
    insert into public.email_send_log (
      sender_user_id, recipient_spec, subject, recipient_count
    ) values (
      'e5100000-0000-0000-0000-000000000002',
      '{"kind":"all"}'::jsonb,
      'esl-nonadmin-insert',
      1
    )
    $test$,
    '42501',
    null,
    'non-admin authenticated cannot insert an email send log row'
  );

-- No UPDATE/DELETE policy exists, so RLS filters the target row before the
-- write reaches it: the statement succeeds but affects zero rows (not an
-- error), same as a WHERE clause matching nothing. The row is also
-- SELECT-invisible to this role, so the verification reads below run after
-- `reset role` (as table owner, which bypasses RLS) rather than in-role.
update public.email_send_log
set
  subject = 'esl-hacked-subject'
where
  subject = 'esl-fixture-subject';

delete from public.email_send_log
where
  subject = 'esl-fixture-subject';

reset role;

select
  is (
    (
      select
        subject
      from
        public.email_send_log
      where
        subject = 'esl-fixture-subject'
    ),
    'esl-fixture-subject',
    'non-admin authenticated update is a no-op (RLS filters the row)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.email_send_log
      where
        subject = 'esl-fixture-subject'
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
  local "request.jwt.claims" = '{"sub":"e5100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.email_send_log
    ),
    1,
    'super admin can read the email send log'
  );

select
  throws_ok (
    $test$
    insert into public.email_send_log (
      sender_user_id, recipient_spec, subject, recipient_count
    ) values (
      'e5100000-0000-0000-0000-000000000001',
      '{"kind":"all"}'::jsonb,
      'esl-superadmin-insert',
      1
    )
    $test$,
    '42501',
    null,
    'super admin cannot directly insert an email send log row (must use service_role Edge Function)'
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
    insert into public.email_send_log (
      sender_user_id, recipient_spec, subject, recipient_count
    ) values (
      'e5100000-0000-0000-0000-000000000001',
      '{"kind":"specific","user_ids":["e5100000-0000-0000-0000-000000000002"]}'::jsonb,
      'esl-service-subject',
      1
    )
    $test$,
    'service_role can insert an email send log row'
  );

update public.email_send_log
set
  recipient_count = 2
where
  subject = 'esl-service-subject';

select
  is (
    (
      select
        recipient_count
      from
        public.email_send_log
      where
        subject = 'esl-service-subject'
    ),
    2,
    'service_role can update an email send log row'
  );

delete from public.email_send_log
where
  subject = 'esl-service-subject';

select
  is (
    (
      select
        count(*)::integer
      from
        public.email_send_log
      where
        subject = 'esl-service-subject'
    ),
    0,
    'service_role can delete an email send log row'
  );

reset role;

select
  finish ();

rollback;
