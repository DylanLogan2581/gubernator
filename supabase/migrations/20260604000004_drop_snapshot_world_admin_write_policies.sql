-- Migration: drop_snapshot_world_admin_write_policies
--
-- Aligns RLS with the Epic 6 simulation engine spec: direct INSERT, UPDATE,
-- and DELETE through the table API are blocked for all roles including World
-- Admin; mutations route exclusively through apply_turn_transition.
--
-- Changes:
--   1. Drop world-admin UPDATE and DELETE policies on both snapshot tables.
--   2. Create super-admin-only UPDATE/DELETE policies as an incident-recovery
--      escape hatch.
--   3. Revoke the column-level INSERT grant restored in the original migrations;
--      direct INSERT is now exclusively through apply_turn_transition (SECURITY
--      DEFINER), which bypasses grants and RLS by running as the function owner.
--      UPDATE was already revoked. DELETE grant is retained so the super-admin
--      escape-hatch policy is reachable via the authenticated role.
--
-- Closes review findings H13 and M14.
-- ---------------------------------------------------------------------------
-- settlement_turn_snapshots
-- ---------------------------------------------------------------------------
drop policy "settlement_turn_snapshots_update_world_admin" on public.settlement_turn_snapshots;

drop policy "settlement_turn_snapshots_delete_world_admin" on public.settlement_turn_snapshots;

create policy "settlement_turn_snapshots_update_super_admin" on public.settlement_turn_snapshots
for update
  to authenticated using (public.is_super_admin ())
with
  check (public.is_super_admin ());

create policy "settlement_turn_snapshots_delete_super_admin" on public.settlement_turn_snapshots for delete to authenticated using (public.is_super_admin ());

-- Revoke the column-level INSERT grants granted back in
-- 20260602000002_add_settlement_turn_snapshots.sql. Direct INSERT via the table
-- API is now fully blocked; the SECURITY DEFINER RPC is the only write path.
revoke insert on public.settlement_turn_snapshots
from
  authenticated;

-- ---------------------------------------------------------------------------
-- settlement_turn_resource_snapshots
-- ---------------------------------------------------------------------------
drop policy "settlement_turn_resource_snapshots_update_world_admin" on public.settlement_turn_resource_snapshots;

drop policy "settlement_turn_resource_snapshots_delete_world_admin" on public.settlement_turn_resource_snapshots;

create policy "settlement_turn_resource_snapshots_update_super_admin" on public.settlement_turn_resource_snapshots
for update
  to authenticated using (public.is_super_admin ())
with
  check (public.is_super_admin ());

create policy "settlement_turn_resource_snapshots_delete_super_admin" on public.settlement_turn_resource_snapshots for delete to authenticated using (public.is_super_admin ());

-- Revoke the column-level INSERT grants granted back in
-- 20260602000003_add_settlement_turn_resource_snapshots.sql.
revoke insert on public.settlement_turn_resource_snapshots
from
  authenticated;
