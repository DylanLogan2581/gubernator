-- Migration: extend_rls_permission_helpers
-- Adds composable permission helpers for Epic 3 (Nation Manager and
-- Settlement Manager roles attached to player_character citizens, active-PC
-- scoping for citizens / partnerships / relationships, and nation
-- visibility). The helpers are intended to be reused by every domain table
-- in Epics 3-6, so naming and shape match the existing helpers added in
-- 20260426000002_permission_helpers.sql and 20260520000000_add_citizens.sql:
--
--   SECURITY DEFINER     -- bypass RLS to avoid recursive policy evaluation.
--   STABLE               -- safe for inlining in RLS policy expressions.
--   SET search_path = '' -- prevents search_path injection.
--
-- public.nations.is_hidden already exists (added in
-- 20260502000001_add_nations.sql), so this migration does not re-add it.
-- ---------------------------------------------------------------------------
-- 1. current_user_player_character_ids(p_world_id)
-- ---------------------------------------------------------------------------
-- Returns the set of citizen ids of every living player_character that the
-- current application user controls in the given world. The empty set is
-- returned when there is no authenticated session, when the user holds no
-- living player_character in the world, and for super admins / world admins
-- who do not themselves control a player_character there. Callers that need
-- "true / false" semantics should use user_has_player_character_in_world.
create or replace function public.current_user_player_character_ids (p_world_id uuid) returns setof uuid language sql stable security definer
set
  search_path = '' as $$
  select c.id
  from public.citizens c
  where c.user_id = auth.uid()
    and c.citizen_type = 'player_character'
    and c.world_id = p_world_id
    and c.status = 'alive'
$$;

-- ---------------------------------------------------------------------------
-- 2. current_user_active_player_character_id(p_world_id)
-- ---------------------------------------------------------------------------
-- Returns the citizen id of the current user's active player_character in
-- the given world, or NULL when no selection is stored. Reads from
-- user_active_player_characters; the cleanup triggers on that table
-- guarantee a non-null result references a living, eligible
-- player_character still linked to the current user.
create or replace function public.current_user_active_player_character_id (p_world_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select citizen_id
  from public.user_active_player_characters
  where user_id = auth.uid()
    and world_id = p_world_id
$$;

-- ---------------------------------------------------------------------------
-- 3. current_user_manages_nation(p_nation_id)
-- ---------------------------------------------------------------------------
-- TRUE when the current user has authority over the nation through any path:
-- super admin, world admin of the nation's world, or the holder of a living
-- player_character whose role is nation_manager of this nation.
create or replace function public.current_user_manages_nation (p_nation_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.nations n
      where n.id = p_nation_id
        and public.is_world_admin(n.world_id)
    )
    or public.is_nation_manager_of(p_nation_id)
$$;

-- ---------------------------------------------------------------------------
-- 4. current_user_manages_settlement(p_settlement_id)
-- ---------------------------------------------------------------------------
-- TRUE when the current user has authority over the settlement through any
-- path: super admin, world admin of the settlement's world, the nation
-- manager of the settlement's parent nation, or the settlement manager
-- assigned to it.
create or replace function public.current_user_manages_settlement (p_settlement_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_super_admin()
    or public.is_settlement_manager_of(p_settlement_id)
    or exists (
      select 1
      from public.settlements s
      join public.nations n on n.id = s.nation_id
      where s.id = p_settlement_id
        and (
          public.is_world_admin(n.world_id)
          or public.is_nation_manager_of(s.nation_id)
        )
    )
$$;

-- ---------------------------------------------------------------------------
-- 5. current_user_has_world_access(p_world_id)
-- ---------------------------------------------------------------------------
-- Extends has_world_access with the player-character path: an active user
-- who controls at least one player_character in the world is admitted
-- regardless of the world's visibility setting. All Epic 1 paths (world
-- owner, public world reader, explicit world_admin, super admin) continue
-- to qualify via the wrapped has_world_access helper, so existing world
-- access RLS that swaps to this function keeps its current behavior.
create or replace function public.current_user_has_world_access (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.has_world_access(p_world_id)
    or (
      public.is_active_app_user()
      and public.user_has_player_character_in_world(p_world_id)
    )
$$;

-- ---------------------------------------------------------------------------
-- 6. nation_visible_to_current_user(p_nation_id)
-- ---------------------------------------------------------------------------
-- TRUE when the current user is permitted to see the nation through a
-- privileged path: super admin, world admin of the nation's world, or any
-- user who controls a living player_character whose settlement belongs to
-- the nation. Read RLS on nations layers the non-hidden + world-access path
-- on top of this helper so the is_hidden flag remains private to the three
-- privileged paths above.
create or replace function public.nation_visible_to_current_user (p_nation_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.nations n
      where n.id = p_nation_id
        and public.is_world_admin(n.world_id)
    )
    or exists (
      select 1
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
      where c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
        and s.nation_id = p_nation_id
    )
$$;

-- ---------------------------------------------------------------------------
-- 7. world_is_archived(p_world_id)
-- ---------------------------------------------------------------------------
-- TRUE when the given world is archived (either status = 'archived' or
-- archived_at is not null). Used by mutation RPCs to reject operations on
-- frozen worlds. Extraction into a helper ensures consistent archived-world
-- semantics across all manager and admin RPCs.
create or replace function public.world_is_archived (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    exists (
      select 1
      from public.worlds w
      where w.id = p_world_id
        and (w.status = 'archived' or w.archived_at is not null)
    )
$$;

-- ---------------------------------------------------------------------------
-- Execution grants: revoke from public, grant execute to authenticated, in
-- line with the helpers added in 20260520000000_add_citizens.sql.
-- ---------------------------------------------------------------------------
revoke all on function public.current_user_player_character_ids (uuid)
from
  public;

revoke all on function public.current_user_active_player_character_id (uuid)
from
  public;

revoke all on function public.current_user_manages_nation (uuid)
from
  public;

revoke all on function public.current_user_manages_settlement (uuid)
from
  public;

revoke all on function public.current_user_has_world_access (uuid)
from
  public;

revoke all on function public.nation_visible_to_current_user (uuid)
from
  public;

revoke all on function public.world_is_archived (uuid)
from
  public;

grant
execute on function public.current_user_player_character_ids (uuid) to authenticated;

grant
execute on function public.current_user_active_player_character_id (uuid) to authenticated;

grant
execute on function public.current_user_manages_nation (uuid) to authenticated;

grant
execute on function public.current_user_manages_settlement (uuid) to authenticated;

grant
execute on function public.current_user_has_world_access (uuid) to authenticated;

grant
execute on function public.nation_visible_to_current_user (uuid) to authenticated;

grant
execute on function public.world_is_archived (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Read RLS rewiring
-- ---------------------------------------------------------------------------
-- nations: gate the row by the new visibility helper first, then admit
-- non-hidden nations through the broader world-access path. Hidden nations
-- remain visible only to super admins, world admins of the nation's world,
-- and users who control a player_character in the nation.
drop policy "nations_select_world_access" on public.nations;

create policy "nations_select_world_access" on public.nations for
select
  to authenticated using (
    public.nation_visible_to_current_user (id)
    or (
      is_hidden = false
      and public.current_user_has_world_access (world_id)
    )
  );

-- nation_relationships: a relationship row is visible when either
-- participating nation is visible to the current user. The OR with the
-- non-hidden + world-access path keeps parity with the nations select
-- policy above so relationship visibility does not diverge from nation
-- visibility.
drop policy "nation_relationships_select_visible" on public.nation_relationships;

create policy "nation_relationships_select_visible" on public.nation_relationships for
select
  to authenticated using (
    public.nation_visible_to_current_user (from_nation_id)
    or public.nation_visible_to_current_user (to_nation_id)
    or exists (
      select
        1
      from
        public.nations n
      where
        n.id in (
          nation_relationships.from_nation_id,
          nation_relationships.to_nation_id
        )
        and n.is_hidden = false
        and public.current_user_has_world_access (n.world_id)
    )
  );
