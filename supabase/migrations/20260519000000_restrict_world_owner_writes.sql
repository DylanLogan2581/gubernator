-- Migration: restrict_world_owner_writes
-- Limits browser-authenticated writes on public.worlds to explicit owner
-- metadata columns. State-machine fields (current_turn_number, status,
-- archived_at) and system timestamps remain writable only through privileged
-- database paths such as advance_world_turn_if_current and dedicated archive
-- workflows. Column-level privileges are checked before RLS, so the restriction
-- applies independently of policy logic.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.worlds
from
  authenticated;

grant
update (name, visibility, calendar_config_json) on public.worlds to authenticated;

grant insert (
  id,
  name,
  owner_id,
  visibility,
  calendar_config_json
) on public.worlds to authenticated;
