-- pgTAP tests for admin_create_user_idempotency_keys composite primary key
-- (issue #960): idempotency-key results must be scoped per caller_user_id,
-- not global. Prior to 20260813000000_scope_admin_idempotency_keys_per_caller.sql,
-- idempotency_key alone was the primary key, so a second caller reusing the
-- same key value as a first caller would collide with the first caller's row.
-- Run with: npx supabase test db
begin;

select
  plan (3);

-- Two different callers reusing the same idempotency_key value must be able
-- to coexist: the key space is per-caller, not global.
select
  lives_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'shared-key',
      'a0000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001',
      'caller-a-created@example.com',
      'caller_a_created'
    )
    $test$,
    'first caller may insert idempotency_key shared-key'
  );

select
  lives_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'shared-key',
      'a0000000-0000-0000-0000-000000000002',
      'b0000000-0000-0000-0000-000000000002',
      'caller-b-created@example.com',
      'caller_b_created'
    )
    $test$,
    'second caller may reuse idempotency_key shared-key (independent from first caller)'
  );

-- The same caller reusing their own idempotency_key value still collides,
-- preserving idempotency semantics per caller.
select
  throws_ok (
    $test$
    insert into public.admin_create_user_idempotency_keys (
      idempotency_key, caller_user_id, created_user_id, created_user_email, created_user_username
    ) values (
      'shared-key',
      'a0000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000003',
      'caller-a-retry@example.com',
      'caller_a_retry'
    )
    $test$,
    '23505',
    null,
    'same caller reusing idempotency_key shared-key violates composite primary key'
  );

select
  *
from
  finish ();

rollback;
