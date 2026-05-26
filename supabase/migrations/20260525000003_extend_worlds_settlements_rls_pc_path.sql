-- Migration: extend_worlds_settlements_rls_pc_path
-- Wires current_user_has_world_access into the worlds and settlements SELECT
-- policies so a user whose only access path is a living player_character in the
-- world can read the world row and the settlements inside it.
--
-- worlds: adds worlds_select_player_character policy using the composed helper.
-- settlements: replaces settlements_select_world_access (was has_world_access)
--              with current_user_has_world_access to include the PC path.
-- ---------------------------------------------------------------------------
-- worlds: add a SELECT policy for the player-character access path
-- ---------------------------------------------------------------------------
create policy "worlds_select_player_character" on public.worlds for
select
  to authenticated using (public.current_user_has_world_access (id));

-- ---------------------------------------------------------------------------
-- settlements: update select policy to use current_user_has_world_access
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
