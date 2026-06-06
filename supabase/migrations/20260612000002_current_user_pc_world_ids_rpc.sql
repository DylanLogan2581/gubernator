-- Returns the distinct set of world_ids where the current authenticated user
-- has at least one living player_character. Returns an empty set when no JWT
-- is present or the user has no qualifying citizens.
create or replace function public.current_user_player_character_world_ids () returns setof uuid language sql stable security definer
set
  search_path = '' as $$
  select distinct c.world_id
  from public.citizens c
  where c.user_id = auth.uid()
    and c.citizen_type = 'player_character'
    and c.status = 'alive'
$$;

revoke all on function public.current_user_player_character_world_ids ()
from
  public;

grant
execute on function public.current_user_player_character_world_ids () to authenticated;
