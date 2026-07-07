-- Migration: widen_citizen_visibility_for_players
-- The redesign makes citizens (including NPCs) visible everywhere — tables,
-- directory, links — so any world member needs read-only access to any
-- citizen's public fields, not just player_character rows.
--
-- 20260611000003_restrict_citizen_npc_visibility.sql narrowed
-- citizens_select_visible (and its citizen_visible_to_current_user mirror) to
-- admit NPC rows only for super admins and world admins. This migration
-- removes that citizen_type restriction and restores the broader predicate
-- from the original add_citizens migration: super admin | world admin |
-- nation manager (via settlement) | settlement manager | any PC holder in the
-- citizen's world — now applying to NPC rows too.
--
-- The column-level SELECT restriction on the seven NPC-flavor columns
-- (personality_text, skills_text, npc_trait_1, npc_trait_2,
-- npc_secret_contradiction, npc_goal, npc_flaw) introduced in the same prior
-- migration is untouched: those columns remain unreachable through the table
-- API for every authenticated caller, and admin reads still go through the
-- get_citizen_admin_details SECURITY DEFINER getter RPC. citizen_memories
-- (admin-only) and the NPC-notes/lifecycle mutation RPCs are likewise
-- untouched — this migration only concerns citizens row visibility.
-- ---------------------------------------------------------------------------
-- 1. Recreate citizens_select_visible without the citizen_type restriction.
-- ---------------------------------------------------------------------------
drop policy "citizens_select_visible" on public.citizens;

create policy "citizens_select_visible" on public.citizens for
select
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
    or (
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
  );

-- ---------------------------------------------------------------------------
-- 2. Mirror the same predicate in citizen_visible_to_current_user so
--    partnership visibility (which calls this helper) widens in lockstep and
--    cannot be used to enumerate NPC rows the row policy itself now permits.
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
$$;
