-- Migration: fix_turn_transitions_rls_pc_path
-- Replaces has_world_access with current_user_has_world_access on the select
-- policies for turn_transitions and turn_log_entries so that player characters
-- with alive PCs in a private world can read turn history for that world.
drop policy "turn_transitions_select_world_access" on public.turn_transitions;

create policy "turn_transitions_select_world_access" on public.turn_transitions for
select
  to authenticated using (public.current_user_has_world_access (world_id));

drop policy "turn_log_entries_select_world_access" on public.turn_log_entries;

create policy "turn_log_entries_select_world_access" on public.turn_log_entries for
select
  to authenticated using (public.current_user_has_world_access (world_id));
