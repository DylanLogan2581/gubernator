-- Migration: revoke_partnership_direct_writes
-- Routes all partnership writes through the audit-recording SECURITY DEFINER
-- RPCs by revoking INSERT, UPDATE, and DELETE on public.partnerships from the
-- authenticated role. Direct table-API mutations bypassed the turn_log_entries
-- invariant established in 20260522000003_add_partnership_mutations.sql; this
-- makes that invariant structurally enforced rather than a convention.
--
-- The write policies introduced in 20260520000002_add_partnerships.sql are
-- dropped: with no table-level grant the policies are unreachable and their
-- presence is misleading. The four SECURITY DEFINER RPCs (create_partnership,
-- dissolve_partnership, mark_partnership_widowed, reassign_partner) run under
-- the function-owner privileges and are unaffected by the revoke.
revoke insert,
update,
delete on public.partnerships
from
  authenticated;

drop policy if exists "partnerships_insert_admin" on public.partnerships;

drop policy if exists "partnerships_update_admin" on public.partnerships;

drop policy if exists "partnerships_delete_admin" on public.partnerships;
