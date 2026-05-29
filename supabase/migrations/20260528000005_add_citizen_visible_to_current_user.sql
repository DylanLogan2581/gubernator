-- Migration: add_citizen_visible_to_current_user
-- Adds a SECURITY DEFINER helper that encapsulates the citizens visibility
-- predicate for a single citizen id, then rewires partnerships_select_visible
-- to call it instead of two inline sub-selects against public.citizens.
--
-- The helper runs as the function owner (bypassing citizens RLS), so it does
-- not recursively trigger the citizens select policy. It mirrors the logic of
-- citizens_select_visible exactly:
--   super admin | world admin | nation manager (via settlement) |
--   settlement manager | any PC holder in the citizen's world.
-- ---------------------------------------------------------------------------
create or replace function public.citizen_visible_to_current_user (p_citizen_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    where c.id = p_citizen_id
      and (
        public.is_super_admin()
        or public.is_world_admin(c.world_id)
        or (
          c.settlement_id is not null
          and exists (
            select 1
            from public.settlements s
            where s.id = c.settlement_id
              and public.is_nation_manager_of(s.nation_id)
          )
        )
        or (
          c.settlement_id is not null
          and public.is_settlement_manager_of(c.settlement_id)
        )
        or public.user_has_player_character_in_world(c.world_id)
      )
  )
$$;

revoke all on function public.citizen_visible_to_current_user (uuid)
from
  public;

grant
execute on function public.citizen_visible_to_current_user (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rewire partnerships_select_visible to call the helper once per side instead
-- of two independent sub-selects that each re-evaluate the citizens RLS policy.
-- ---------------------------------------------------------------------------
drop policy "partnerships_select_visible" on public.partnerships;

create policy "partnerships_select_visible" on public.partnerships for
select
  to authenticated using (
    public.citizen_visible_to_current_user (citizen_a_id)
    or public.citizen_visible_to_current_user (citizen_b_id)
  );
