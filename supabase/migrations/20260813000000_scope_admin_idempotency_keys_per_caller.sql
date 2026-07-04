-- Scope admin-create-user idempotency keys per caller (issue #960).
--
-- Previously `idempotency_key` alone was the primary key, so the key space
-- was effectively global: a second super-admin reusing the same key value
-- as a first super-admin would collide with (and, once the Edge Function's
-- lookup query is scoped by caller_user_id, be shadowed by) the first
-- caller's row. Replace the single-column primary key with a composite one
-- so each caller has an independent idempotency-key namespace.
alter table public.admin_create_user_idempotency_keys
drop constraint admin_create_user_idempotency_keys_pkey;

alter table public.admin_create_user_idempotency_keys
add constraint admin_create_user_idempotency_keys_pkey primary key (caller_user_id, idempotency_key);
