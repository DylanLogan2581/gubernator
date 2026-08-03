-- Migration: add_world_list_stats_rpc
-- Adds get_world_list_stats(): a SECURITY DEFINER RPC that returns per-world
-- aggregate stats — the living player-character count and the most recent turn
-- transition start time — for every world the caller can access. Powers the
-- /worlds list cards (#1360) with a single batched query instead of an N+1
-- per-card lookup.
--
-- Access model: the function bypasses RLS on citizens/turn_transitions
-- (SECURITY DEFINER) so the counts are complete regardless of the caller's
-- granular per-settlement citizen visibility. It restricts the returned rows
-- to worlds the caller may see using the same predicate as the worlds SELECT
-- policy (is_super_admin / is_world_admin / current_user_has_world_access), so
-- no world stats leak beyond what the worlds table itself already exposes.
create or replace function public.get_world_list_stats () returns table (
  world_id uuid,
  player_character_count bigint,
  last_transition_at timestamptz
) language sql stable security definer
set
  search_path = '' as $$
  select
    w.id as world_id,
    (
      select count(*)
      from public.citizens c
      where c.world_id = w.id
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
    ) as player_character_count,
    (
      select max(tt.started_at)
      from public.turn_transitions tt
      where tt.world_id = w.id
    ) as last_transition_at
  from public.worlds w
  where public.is_super_admin ()
    or public.is_world_admin (w.id)
    or public.current_user_has_world_access (w.id);
$$;

revoke all on function public.get_world_list_stats ()
from
  public;

grant
execute on function public.get_world_list_stats () to authenticated;
