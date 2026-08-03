-- Migration: fix_recruit_soldiers_cost_aggregation_and_assignment_clear
-- #1146: recruit_soldiers (20260930000000) had two defects, redefined in
-- full from its only prior definition:
--   1. recruitment_costs_json entries were checked/deducted per-entry, not
--      aggregated per resource_id. Duplicate resource_id entries could each
--      pass the availability check against the same undecremented snapshot
--      even when their combined total exceeded the stockpile, then the
--      second deduct update would trip the stockpile's `quantity >= 0`
--      check constraint -- raising a raw 23514 instead of the
--      'insufficient_resources' hint. Both the check and deduct loops now
--      aggregate cost entries by resource_id first.
--   2. A citizen with an existing citizen_assignments row (job/deposit/
--      trade/etc.) could be recruited without that row being cleared --
--      mirroring apply_turn_transition's assignmentClears patch, the
--      citizen's assignment row is now deleted at recruit time so the
--      settlement's job/deposit/trade-route counts don't keep counting a
--      citizen who has left the labor pool to serve as a soldier.
-- ---------------------------------------------------------------------------
create or replace function public.recruit_soldiers (
  p_unit_id uuid,
  p_settlement_id uuid,
  p_citizen_ids uuid[]
) returns setof public.unit_soldiers language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_unit_type_id uuid;
  v_soldiers_per_unit integer;
  v_required_education_level_id uuid;
  v_required_education_rank integer;
  v_required_education_name text;
  v_required_building_blueprint_id uuid;
  v_required_building_tier_number integer;
  v_recruitment_costs_json jsonb;
  v_funding_source text;
  v_stationed_settlement_id uuid;
  v_settlement_nation_id uuid;
  v_current_soldier_count integer;
  v_new_count integer;
  v_citizen_id uuid;
  v_citizen record;
  v_cost_row record;
  v_cost_resource_id uuid;
  v_cost_amount numeric;
  v_total_required numeric;
  v_available numeric;
  v_missing text[] := array[]::text[];
  v_resource_name text;
  v_row public.unit_soldiers%rowtype;
begin
  if p_unit_id is null or p_settlement_id is null or p_citizen_ids is null
    or array_length(p_citizen_ids, 1) is null then
    raise exception 'unit, settlement, and at least one citizen are required'
      using errcode = '22023';
  end if;

  v_new_count := array_length(p_citizen_ids, 1);

  if v_new_count <> (select count(distinct x) from unnest(p_citizen_ids) x) then
    raise exception 'citizen list must not contain duplicates'
      using errcode = '22023';
  end if;

  select au.army_id, a.nation_id, a.world_id, w.status, w.current_turn_number,
    au.unit_type_id, a.funding_source, a.stationed_settlement_id
  into v_army_id, v_nation_id, v_world_id, v_world_status, v_turn_number,
    v_unit_type_id, v_funding_source, v_stationed_settlement_id
  from public.army_units au
  inner join public.armies a on a.id = au.army_id
  inner join public.worlds w on w.id = a.world_id
  where au.id = p_unit_id
  for update of au;

  if v_army_id is null then
    raise exception 'unit not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select s.nation_id into v_settlement_nation_id
  from public.settlements s
  where s.id = p_settlement_id;

  if v_settlement_nation_id is null then
    raise exception 'settlement not found'
      using errcode = 'P0002';
  end if;

  if v_settlement_nation_id <> v_nation_id then
    raise exception 'settlement must belong to the nation'
      using errcode = '22023', hint = 'settlement_not_in_nation';
  end if;

  select ut.soldiers_per_unit, ut.required_education_level_id, ut.required_building_blueprint_id,
    ut.required_building_tier_number, ut.recruitment_costs_json
  into v_soldiers_per_unit, v_required_education_level_id, v_required_building_blueprint_id,
    v_required_building_tier_number, v_recruitment_costs_json
  from public.unit_types ut
  where ut.id = v_unit_type_id;

  if v_required_education_level_id is not null then
    select rank, name into v_required_education_rank, v_required_education_name
    from public.education_levels
    where id = v_required_education_level_id;
  end if;

  -- Building requirement: an active settlement_buildings row of the required
  -- blueprint at >= the required tier.
  if v_required_building_blueprint_id is not null then
    if not exists (
      select 1
      from public.settlement_buildings sb
      inner join public.building_blueprint_tiers bbt on bbt.id = sb.current_tier_id
      where sb.settlement_id = p_settlement_id
        and sb.state = 'active'
        and sb.building_blueprint_id = v_required_building_blueprint_id
        and bbt.tier_number >= v_required_building_tier_number
    ) then
      raise exception 'settlement lacks the building required for this unit type'
        using errcode = '22023', hint = 'building_requirement_not_met';
    end if;
  end if;

  -- Unit capacity.
  select count(*) into v_current_soldier_count
  from public.unit_soldiers
  where unit_id = p_unit_id;

  if v_current_soldier_count + v_new_count > v_soldiers_per_unit then
    raise exception 'unit capacity exceeded: % current + % new > % max',
      v_current_soldier_count, v_new_count, v_soldiers_per_unit
      using errcode = '22023', hint = 'unit_capacity_exceeded';
  end if;

  if (select count(*) from public.citizens c where c.id = any (p_citizen_ids)) <> v_new_count then
    raise exception 'one or more citizens not found'
      using errcode = 'P0002';
  end if;

  -- Per-citizen eligibility.
  for v_citizen in
    select c.id, c.name, c.status, c.settlement_id, c.education_level_id
    from public.citizens c
    where c.id = any (p_citizen_ids)
    for update of c
  loop
    if v_citizen.status <> 'alive' then
      raise exception 'Citizen % is not alive', v_citizen.name
        using errcode = '22023', hint = 'citizen_not_alive';
    end if;

    if v_citizen.settlement_id is distinct from p_settlement_id then
      raise exception 'Citizen % is not a resident of the settlement', v_citizen.name
        using errcode = '22023', hint = 'citizen_not_resident';
    end if;

    if exists (select 1 from public.unit_soldiers us where us.citizen_id = v_citizen.id) then
      raise exception 'Citizen % is already a soldier', v_citizen.name
        using errcode = '22023', hint = 'citizen_already_soldier';
    end if;

    if exists (select 1 from public.education_enrollments ee where ee.citizen_id = v_citizen.id) then
      raise exception 'Citizen % is enrolled in school', v_citizen.name
        using errcode = '22023', hint = 'citizen_enrolled';
    end if;

    if exists (select 1 from public.nation_offices no_ where no_.citizen_id = v_citizen.id) then
      raise exception 'Citizen % holds a nation office', v_citizen.name
        using errcode = '22023', hint = 'citizen_officeholder';
    end if;

    if v_required_education_level_id is not null then
      if v_citizen.education_level_id is null or not exists (
        select 1 from public.education_levels cel
        where cel.id = v_citizen.education_level_id
          and cel.rank >= v_required_education_rank
      ) then
        raise exception 'Citizen % lacks required education (%)', v_citizen.name, v_required_education_name
          using errcode = '22023', hint = 'citizen_lacks_education';
      end if;
    end if;
  end loop;

  -- Cost check: aggregate recruitment_costs_json entries by resource_id
  -- first (duplicate resource_id entries must not be checked individually
  -- against the same undecremented stockpile snapshot), then gather every
  -- resource that would fall short before touching any stockpile, so a
  -- shortfall lists all missing resources at once.
  for v_cost_row in
    select (entry ->> 'resource_id')::uuid as resource_id,
      sum((entry ->> 'amount')::numeric) as amount
    from jsonb_array_elements(v_recruitment_costs_json) as entry
    where entry ->> 'resource_id' is not null
      and (entry ->> 'amount')::numeric > 0
    group by (entry ->> 'resource_id')::uuid
  loop
    v_cost_resource_id := v_cost_row.resource_id;
    v_cost_amount := v_cost_row.amount;
    v_total_required := v_cost_amount * v_new_count;

    if v_funding_source = 'nation' then
      select quantity into v_available
      from public.nation_resource_stockpiles
      where nation_id = v_nation_id and resource_id = v_cost_resource_id
      for update;
    else
      select quantity into v_available
      from public.settlement_resource_stockpiles
      where settlement_id = v_stationed_settlement_id and resource_id = v_cost_resource_id
      for update;
    end if;

    v_available := coalesce(v_available, 0);

    if v_available < v_total_required then
      select r.name into v_resource_name from public.resources r where r.id = v_cost_resource_id;
      v_missing := v_missing || (
        coalesce(v_resource_name, v_cost_resource_id::text)
        || ' (need ' || v_total_required || ', have ' || v_available || ')'
      );
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception 'insufficient resources: %', array_to_string(v_missing, ', ')
      using errcode = '22023', hint = 'insufficient_resources';
  end if;

  -- Deduct: same per-resource aggregation as the check above, so a resource
  -- listed more than once in recruitment_costs_json is only deducted once
  -- for its combined total.
  for v_cost_row in
    select (entry ->> 'resource_id')::uuid as resource_id,
      sum((entry ->> 'amount')::numeric) as amount
    from jsonb_array_elements(v_recruitment_costs_json) as entry
    where entry ->> 'resource_id' is not null
      and (entry ->> 'amount')::numeric > 0
    group by (entry ->> 'resource_id')::uuid
  loop
    v_cost_resource_id := v_cost_row.resource_id;
    v_cost_amount := v_cost_row.amount;
    v_total_required := v_cost_amount * v_new_count;

    if v_funding_source = 'nation' then
      update public.nation_resource_stockpiles
      set quantity = quantity - v_total_required
      where nation_id = v_nation_id and resource_id = v_cost_resource_id;
    else
      update public.settlement_resource_stockpiles
      set quantity = quantity - v_total_required
      where settlement_id = v_stationed_settlement_id and resource_id = v_cost_resource_id;
    end if;
  end loop;

  -- Recruit. Clear any existing citizen_assignments row first, mirroring
  -- apply_turn_transition's assignmentClears patch -- a soldier has left the
  -- settlement's labor pool and must stop counting toward its job/deposit/
  -- trade-route assignment totals.
  for v_citizen_id in select unnest(p_citizen_ids)
  loop
    delete from public.citizen_assignments where citizen_id = v_citizen_id;

    insert into public.unit_soldiers (
      world_id, unit_id, citizen_id, home_settlement_id, recruited_turn_number
    )
    values (v_world_id, p_unit_id, v_citizen_id, p_settlement_id, v_turn_number)
    returning * into v_row;

    return next v_row;
  end loop;

  return;
end;
$$;

revoke all on function public.recruit_soldiers (uuid, uuid, uuid[])
from
  public;

grant
execute on function public.recruit_soldiers (uuid, uuid, uuid[]) to authenticated;
