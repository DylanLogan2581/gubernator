-- Migration: drop_partnership_admin_can_write
-- Removes the dead-code partnership_admin_can_write helper introduced in
-- 20260522000003_add_partnership_mutations.sql. The function was never called
-- by any partnership RPC; each RPC inlines its own admin check instead. This
-- cleans up the public API surface and the authenticated grant.
drop function if exists public.partnership_admin_can_write (uuid);
