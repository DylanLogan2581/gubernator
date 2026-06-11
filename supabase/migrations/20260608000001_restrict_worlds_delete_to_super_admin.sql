-- Migration: restrict_worlds_delete_to_super_admin
-- Drops worlds_delete_owner so the only DELETE policy on public.worlds is
-- worlds_delete_super_admin (added in 20260426000003_rls_policy_overhaul.sql).
-- Owners and world admins can no longer bypass the trash lifecycle by calling
-- table-API DELETE directly; hard deletion is super-admin-only via
-- hard_delete_world().
drop policy "worlds_delete_owner" on public.worlds;
