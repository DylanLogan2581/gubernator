-- Migration: restrict_citizen_npc_visibility
-- Restricts citizen NPC row visibility and flavor column access.
--
-- Row-level change: non-admin paths in citizens_select_visible now admit only
-- citizen_type = 'player_character' rows. Super admin and World admin paths
-- are unchanged and continue to see all rows.
--
-- Column-level change: SELECT on the seven NPC-flavor columns is revoked from
-- the authenticated role so non-admin callers cannot read them even if a future
-- policy change accidentally exposes an NPC row. Admin reads must go through
-- the get_citizen_admin_details SECURITY DEFINER getter RPC, which enforces
-- its own admin check before projecting those columns.
--
-- citizen_visible_to_current_user is updated to mirror the new row-level
-- predicate so partnership visibility cannot be used to enumerate NPC rows.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 1. Drop and recreate citizens_select_visible
-- ---------------------------------------------------------------------------
drop policy "citizens_select_visible" on public.citizens;

create policy "citizens_select_visible" on public.citizens for
select
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
    or (
      citizen_type = 'player_character'
      and (
        (
          settlement_id is not null
          and exists (
            select
              1
            from
              public.settlements s
            where
              s.id = citizens.settlement_id
              and public.is_nation_manager_of (s.nation_id)
          )
        )
        or (
          settlement_id is not null
          and public.is_settlement_manager_of (settlement_id)
        )
        or public.user_has_player_character_in_world (world_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Column-level SELECT restriction: revoke table-level SELECT and re-grant
--    only the non-flavor columns. This prevents direct table API reads of
--    personality_text, skills_text, npc_trait_1, npc_trait_2,
--    npc_secret_contradiction, npc_goal, and npc_flaw from any authenticated
--    caller. Admins must use get_citizen_admin_details (SECURITY DEFINER)
--    to read those columns.
-- ---------------------------------------------------------------------------
revoke
select
  on public.citizens
from
  authenticated;

grant
select
  (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    surname,
    name,
    sex,
    status,
    born_on_turn_number,
    parent_a_citizen_id,
    parent_b_citizen_id,
    user_id,
    profile_photo_url,
    role_type,
    role_nation_id,
    role_settlement_id,
    death_cause,
    death_cause_category,
    created_at,
    updated_at
  ) on public.citizens to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Update citizen_visible_to_current_user to mirror the new row-level
--    predicate. NPC rows are no longer visible to non-admin callers.
-- ---------------------------------------------------------------------------
create or replace function public.citizen_visible_to_current_user (p_citizen_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    where c.id = p_citizen_id
      and (
        public.is_super_admin ()
        or public.is_world_admin (c.world_id)
        or (
          c.citizen_type = 'player_character'
          and (
            (
              c.settlement_id is not null
              and exists (
                select 1
                from public.settlements s
                where s.id = c.settlement_id
                  and public.is_nation_manager_of (s.nation_id)
              )
            )
            or (
              c.settlement_id is not null
              and public.is_settlement_manager_of (c.settlement_id)
            )
            or public.user_has_player_character_in_world (c.world_id)
          )
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Admin-only getter RPC for NPC flavor columns.
--    Raises 42501 if the caller is not a super admin or a world admin of the
--    citizen's world. Returns the seven flavor columns for the given citizen
--    id so the frontend admin detail view can fetch them separately.
-- ---------------------------------------------------------------------------
create or replace function public.get_citizen_admin_details (p_citizen_id uuid) returns table (
  personality_text text,
  skills_text text,
  npc_trait_1 text,
  npc_trait_2 text,
  npc_secret_contradiction text,
  npc_goal text,
  npc_flaw text
) language plpgsql stable security definer
set
  search_path = '' as $$
begin
  if not (
    public.is_super_admin ()
    or exists (
      select 1
      from public.citizens c
      where c.id = p_citizen_id
        and public.is_world_admin (c.world_id)
    )
  ) then
    raise exception 'insufficient_privilege'
      using errcode = '42501',
            detail   = 'caller is not a world admin or super admin';
  end if;

  return query
  select
    c.personality_text,
    c.skills_text,
    c.npc_trait_1,
    c.npc_trait_2,
    c.npc_secret_contradiction,
    c.npc_goal,
    c.npc_flaw
  from public.citizens c
  where c.id = p_citizen_id;
end;
$$;

revoke all on function public.get_citizen_admin_details (uuid)
from
  public;

grant
execute on function public.get_citizen_admin_details (uuid) to authenticated;
