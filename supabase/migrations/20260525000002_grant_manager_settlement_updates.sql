-- Migration: grant_manager_settlement_updates
-- Extends settlements RLS so that nation managers and settlement managers
-- can read and update the settlements they govern.
--
-- SELECT: replace has_world_access with current_user_has_world_access so
-- that player characters (including nation/settlement managers) in a private
-- world can read its settlements, matching the pattern used for nations in
-- 20260522000001_extend_rls_permission_helpers.sql.
--
-- UPDATE: replace the world-admin-only policy with one that also admits the
-- nation manager of the parent nation and the assigned settlement manager via
-- the existing current_user_manages_settlement helper. Column-level grants
-- in 20260519000002_restrict_child_domain_writes.sql already restrict direct
-- writes to name, description, coord_x, coord_z; no column change is needed.
-- ---------------------------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------------------------
drop policy "settlements_select_world_access" on public.settlements;

create policy "settlements_select_world_access" on public.settlements for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = settlements.nation_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- ---------------------------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------------------------
drop policy "settlements_update_world_admin" on public.settlements;

create policy "settlements_update_managers" on public.settlements
for update
  to authenticated using (
    public.current_user_manages_settlement (settlements.id)
  )
with
  check (
    public.current_user_manages_settlement (settlements.id)
  );
