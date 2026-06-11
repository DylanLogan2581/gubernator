-- admin-create-user idempotency table.
--
-- Stores idempotency keys to prevent duplicate user creation calls to GoTrue
-- during request replays or network retries. Keyed on idempotency-key header
-- to support standard HTTP idempotency semantics.
--
-- Decision: super-admin endpoint (verified super-admin required) implements
-- application-level idempotency to prevent accidental duplicate user creation
-- during client retries, while acknowledging bounded threat model (caller
-- must be super-admin).
create table if not exists public.admin_create_user_idempotency_keys (
  -- Idempotency key provided by client (idempotency-key header)
  idempotency_key text primary key,
  -- User ID of caller (super-admin who initiated the request)
  caller_user_id uuid not null,
  -- Response data: created user ID
  created_user_id uuid not null,
  -- Response data: created user email
  created_user_email text not null,
  -- Response data: created user username
  created_user_username text not null,
  -- Request received timestamp
  created_at timestamp with time zone not null default now(),
  -- Expiry for cleanup (24 hours by default)
  expires_at timestamp with time zone not null default now() + interval '24 hours'
);

-- Index for cleanup query (find expired entries)
create index if not exists admin_create_user_idempotency_keys_expires_at_idx on public.admin_create_user_idempotency_keys (expires_at);

-- Automatic cleanup of expired entries via cron (optional, for now just documents cleanup strategy)
-- In production, run: DELETE FROM admin_create_user_idempotency_keys WHERE expires_at < now();
