-- Migration: add_smtp_settings
-- DB-backed SMTP configuration, editable by superadmins from
-- /superadmin/email (issue #1234). Single-row table (enforced by the
-- `id boolean primary key default true check (id)` pattern); all access
-- goes through the send-email Edge Function using the service_role key,
-- which bypasses RLS. The password column must never reach a
-- client-readable surface, so this table has no client policies at all
-- (deny-all) plus an explicit revoke.
create table public.smtp_settings (
  id boolean primary key default true check (id),
  host text not null check (char_length(host) between 1 and 255),
  port integer not null check (port between 1 and 65535),
  username text,
  password text,
  admin_email text not null check (char_length(admin_email) between 1 and 254),
  sender_name text not null check (char_length(sender_name) between 1 and 200),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.smtp_settings is 'Single-row DB-backed SMTP configuration. Deny-all RLS: read/write only via the send-email Edge Function service_role client, so the password column is never exposed to a client.';

comment on column public.smtp_settings.updated_by is 'Superadmin who last saved these settings. Set to null when the referenced user is deleted so account deletion is never blocked by this audit column.';

alter table public.smtp_settings enable row level security;

-- Explicit deny-all policy (rather than zero policies) to document intent
-- and satisfy this repo's rls_meta_test guard that every RLS-enabled table
-- has at least one policy. It grants nothing on its own; the revoke below
-- is what actually blocks anon/authenticated at the privilege-check layer,
-- before RLS is even evaluated.
create policy smtp_settings_deny_all on public.smtp_settings for all to authenticated using (false)
with
  check (false);

-- anon and authenticated (including super admins) get 42501 on any access,
-- in-Postgres and independent of the policy above.
revoke all on public.smtp_settings
from
  anon,
  authenticated;
