-- Migration: government_bodies_world_scope_check
-- #1136: government_bodies_insert_authority checked world_is_archived(world_id)
-- and current_user_manages_nation(nation_id)/current_user_manages_settlement(
-- settlement_id) independently, never that world_id actually matches the
-- owning nation/settlement's world. A nation manager could insert a body with
-- their own nation_id but an unrelated world_id, bypassing the archived-world
-- guard and leaking the row via the select policy to that other world's
-- members. Mirrors current_user_can_own_office_type (20261003000000), which
-- solved the identical problem for office_types.
-- ---------------------------------------------------------------------------
-- current_user_can_own_government_body is security definer so the
-- nation/settlement lookup bypasses their RLS -- nation managers commonly
-- have no settlement of their own (see office_types #1114), which means a
-- plain in-policy EXISTS against public.nations/public.settlements would
-- incorrectly deny them here.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_can_own_government_body (
  p_world_id uuid,
  p_nation_id uuid,
  p_settlement_id uuid
) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    case
      when p_nation_id is not null then
        public.current_user_manages_nation (p_nation_id)
        and exists (
          select 1
          from public.nations n
          where n.id = p_nation_id
            and n.world_id = p_world_id
        )
      else
        public.current_user_manages_settlement (p_settlement_id)
        and exists (
          select 1
          from public.settlements s
          join public.nations n on n.id = s.nation_id
          where s.id = p_settlement_id
            and n.world_id = p_world_id
        )
    end
$$;

revoke all on function public.current_user_can_own_government_body (uuid, uuid, uuid)
from
  public;

grant
execute on function public.current_user_can_own_government_body (uuid, uuid, uuid) to authenticated;

drop policy "government_bodies_insert_authority" on public.government_bodies;

create policy "government_bodies_insert_authority" on public.government_bodies for insert to authenticated
with
  check (
    not public.world_is_archived (world_id)
    and public.current_user_can_own_government_body (world_id, nation_id, settlement_id)
  );
