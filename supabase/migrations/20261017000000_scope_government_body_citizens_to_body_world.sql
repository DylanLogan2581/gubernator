-- Migration: scope_government_body_citizens_to_body_world
-- #1137: resolve_government_body_member_ids accepted composition_json
-- "citizens" entries verbatim -- a body owner could list citizen ids from
-- any nation or world, making them eligible amendment proposers/voters for
-- documents of that scope. Restrict "citizens" rule ids to citizens that
-- actually belong to the body's world, and (for a nation-scoped body) whose
-- settlement belongs to that nation, or (for a settlement-scoped body)
-- whose settlement is that settlement.
create or replace function public.resolve_government_body_member_ids (p_body_id uuid) returns setof uuid language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_composition jsonb;
  v_entry jsonb;
  v_kind text;
  v_member_ids uuid[] := '{}';
begin
  select world_id, nation_id, settlement_id, composition_json
  into v_world_id, v_nation_id, v_settlement_id, v_composition
  from public.government_bodies
  where id = p_body_id;

  if not found then
    return;
  end if;

  for v_entry in select value from jsonb_array_elements(v_composition)
  loop
    v_kind := v_entry ->> 'kind';

    if v_kind = 'office_type' then
      v_member_ids := v_member_ids || array(
        select o.citizen_id
        from public.nation_offices o
        where o.office_type_id = (v_entry ->> 'office_type_id')::uuid
          and o.ended_turn_number is null
          and (
            (v_nation_id is not null and o.nation_id = v_nation_id)
            or (v_settlement_id is not null and o.settlement_id = v_settlement_id)
          )
      );
    elsif v_kind = 'citizens' then
      v_member_ids := v_member_ids || array(
        select c.id
        from jsonb_array_elements_text(v_entry -> 'citizen_ids') as elem
        inner join public.citizens c on c.id = elem::uuid
        left join public.settlements s on s.id = c.settlement_id
        where c.world_id = v_world_id
          and (
            (v_nation_id is not null and s.nation_id = v_nation_id)
            or (v_settlement_id is not null and c.settlement_id = v_settlement_id)
          )
      );
    elsif v_kind = 'ruler' then
      if v_nation_id is not null then
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'nation_manager' and c.role_nation_id = v_nation_id
        );
      else
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'settlement_manager' and c.role_settlement_id = v_settlement_id
        );
      end if;
    elsif v_kind = 'settlement_managers' then
      if v_nation_id is not null then
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'settlement_manager'
            and c.role_settlement_id in (
              select s.id from public.settlements s where s.nation_id = v_nation_id
            )
        );
      end if;
    end if;
  end loop;

  return query
    select distinct m
    from unnest(v_member_ids) as m
    inner join public.citizens c on c.id = m
    where c.status = 'alive';
end;
$$;

revoke all on function public.resolve_government_body_member_ids (uuid)
from
  public;

grant
execute on function public.resolve_government_body_member_ids (uuid) to authenticated;
