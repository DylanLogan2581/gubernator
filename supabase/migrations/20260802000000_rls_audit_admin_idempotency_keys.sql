-- Migration: rls_audit_admin_idempotency_keys
-- Enables RLS on admin_create_user_idempotency_keys and restricts direct
-- client access to super admins only.
--
-- Gap found in RLS audit (issue #796): table was created in
-- 20260621000000_admin_create_user_idempotency.sql without RLS enabled,
-- leaving it fully exposed to anon and authenticated roles.
--
-- All write operations go through the admin-create-user Edge Function using
-- the service_role key, which bypasses RLS. Client writes are now blocked.
-- Super admins retain SELECT for operational visibility.
alter table public.admin_create_user_idempotency_keys enable row level security;

-- Super admins may read idempotency records for operational visibility.
-- No INSERT/UPDATE/DELETE policies: all writes go through service_role.
create policy admin_create_user_idempotency_keys_select_super_admin on public.admin_create_user_idempotency_keys for
select
  to authenticated using (public.is_super_admin ());
