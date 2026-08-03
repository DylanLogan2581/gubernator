-- Migration: gate_office_authority_helpers_on_default_row
-- #1147: office_types_world_owner_name_idx (20261003000000) treats a
-- null-owner (world-default) row and a nation-owner row as distinct, so a
-- nation manager can insert a custom office type whose name collides with a
-- world-default's name in the same world (custom office names are
-- intentionally free-form -- see the law_amendments_test.sql "Chancellor"
-- fixture, a custom office type deliberately named after a default for an
-- unrelated office_type_id-based authority check). Authority helpers that
-- gate on a hardcoded default name -- current_user_holds_nation_office and
-- current_user_nation_currency_actor_citizen_id, both always called with a
-- literal like 'bank_governor' -- joined office_types by name only, so a
-- colliding custom row would satisfy the same name match and be granted
-- the default's authority. Both are redefined here to require the matched
-- office_types row be the world-default row itself (nation_id is null),
-- which the unique index guarantees is the one and only row for that
-- (world_id, name) once null-owner is fixed -- copied from the latest
-- prior definition (20261009000001) with that join condition added.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_holds_nation_office (p_nation_id uuid, p_office_type text) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.nation_offices o
    join public.office_types ot on ot.id = o.office_type_id
    join public.citizens c on c.id = o.citizen_id
    where o.nation_id = p_nation_id
      and o.ended_turn_number is null
      and ot.nation_id is null
      and ot.name = p_office_type
      and c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.status = 'alive'
  )
$$;

create or replace function public.current_user_nation_currency_actor_citizen_id (p_nation_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (
      select o.citizen_id
      from public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
      join public.citizens c on c.id = o.citizen_id
      where o.nation_id = p_nation_id
        and o.ended_turn_number is null
        and ot.nation_id is null
        and ot.name = 'bank_governor'
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    ),
    (
      select c.id
      from public.citizens c
      where c.role_type = 'nation_manager'
        and c.role_nation_id = p_nation_id
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    )
  )
$$;
