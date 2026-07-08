-- Migration: add_unit_soldiers
-- Epic 13 (#1109): recruitment turns citizens into soldiers. A soldier is a
-- row linking an existing citizen to an army_unit -- the citizen keeps their
-- identity (name/education/culture) and leaves the settlement labor pool
-- (excluded from job/deposit/trade-route auto-assignment picking and from
-- simulation worker materialization, extending the officeholder (#1081) /
-- student (#1103) exclusion mechanism below). home_settlement_id records
-- where the citizen resided at recruitment so discharge/desertion can send
-- them back.
--
-- delete_army_unit's "must be empty of soldiers" guard was a structural
-- no-op until this migration (see 20260929000000's comment); it is now
-- enforced for real via an explicit check plus a `restrict` FK backstop.
-- ---------------------------------------------------------------------------
-- 1. unit_soldiers
-- ---------------------------------------------------------------------------
create table public.unit_soldiers (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  unit_id uuid not null references public.army_units (id) on delete restrict,
  citizen_id uuid not null references public.citizens (id) on delete cascade,
  home_settlement_id uuid references public.settlements (id) on delete set null,
  recruited_turn_number integer not null,
  created_at timestamptz not null default now(),
  constraint unit_soldiers_citizen_unique unique (citizen_id),
  constraint unit_soldiers_recruited_turn_number_check check (recruited_turn_number >= 0)
);

create index unit_soldiers_world_id_idx on public.unit_soldiers (world_id);

create index unit_soldiers_unit_id_idx on public.unit_soldiers (unit_id);

create index unit_soldiers_home_settlement_id_idx on public.unit_soldiers (home_settlement_id);

alter table public.unit_soldiers enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: world members read; writes only via the security-definer RPCs below
-- (mirrors nation_offices / education_enrollments).
-- ---------------------------------------------------------------------------
create policy "unit_soldiers_select_world_access" on public.unit_soldiers for
select
  to authenticated using (public.current_user_has_world_access (world_id));

grant
select
  on public.unit_soldiers to authenticated;

-- ---------------------------------------------------------------------------
-- 2. recruit_soldiers -- authority: manage-nation for the unit's army's
-- nation. Validates settlement/nation match, per-citizen eligibility, unit
-- capacity, the unit type's building requirement, and deducts
-- recruitment_costs_json x citizen count from the army's funding source
-- (atomic: any guard failure raises and the whole call rolls back).
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
  v_cost jsonb;
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

  -- Cost check: gather every resource that would fall short before touching
  -- any stockpile, so a shortfall lists all missing resources at once.
  for v_cost in select value from jsonb_array_elements(v_recruitment_costs_json) as value
  loop
    v_cost_resource_id := (v_cost ->> 'resource_id')::uuid;
    v_cost_amount := (v_cost ->> 'amount')::numeric;

    if v_cost_resource_id is null or v_cost_amount is null or v_cost_amount <= 0 then
      continue;
    end if;

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

  -- Deduct.
  for v_cost in select value from jsonb_array_elements(v_recruitment_costs_json) as value
  loop
    v_cost_resource_id := (v_cost ->> 'resource_id')::uuid;
    v_cost_amount := (v_cost ->> 'amount')::numeric;

    if v_cost_resource_id is null or v_cost_amount is null or v_cost_amount <= 0 then
      continue;
    end if;

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

  -- Recruit.
  for v_citizen_id in select unnest(p_citizen_ids)
  loop
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

-- ---------------------------------------------------------------------------
-- 3. discharge_soldiers -- authority: manage-nation for each soldier's
-- army's nation. Returns citizens to civilian life at home_settlement_id
-- (already nulled by the FK above if that settlement no longer exists, in
-- which case the current stationed settlement is used instead).
-- ---------------------------------------------------------------------------
create or replace function public.discharge_soldiers (p_soldier_ids uuid[]) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_soldier record;
  v_target_settlement_id uuid;
  v_citizen public.citizens%rowtype;
begin
  if p_soldier_ids is null or array_length(p_soldier_ids, 1) is null then
    raise exception 'at least one soldier is required'
      using errcode = '22023';
  end if;

  if (select count(*) from public.unit_soldiers where id = any (p_soldier_ids))
    <> (select count(distinct x) from unnest(p_soldier_ids) x) then
    raise exception 'one or more soldiers not found'
      using errcode = 'P0002';
  end if;

  for v_soldier in
    select us.id, us.citizen_id, us.home_settlement_id, a.nation_id, a.stationed_settlement_id,
      w.status as world_status
    from public.unit_soldiers us
    inner join public.army_units au on au.id = us.unit_id
    inner join public.armies a on a.id = au.army_id
    inner join public.worlds w on w.id = a.world_id
    where us.id = any (p_soldier_ids)
    for update of us
  loop
    if v_soldier.world_status = 'archived' then
      raise exception 'Archived worlds are read-only.'
        using errcode = '22023', hint = 'world_archived';
    end if;

    if not public.current_user_manages_nation (v_soldier.nation_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;

    v_target_settlement_id := coalesce(v_soldier.home_settlement_id, v_soldier.stationed_settlement_id);

    update public.citizens
    set settlement_id = v_target_settlement_id
    where id = v_soldier.citizen_id
    returning * into v_citizen;

    delete from public.unit_soldiers where id = v_soldier.id;

    return next v_citizen;
  end loop;

  return;
end;
$$;

revoke all on function public.discharge_soldiers (uuid[])
from
  public;

grant
execute on function public.discharge_soldiers (uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. delete_army_unit: the "must be empty of soldiers" guard is now real.
-- ---------------------------------------------------------------------------
create or replace function public.delete_army_unit (p_unit_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
begin
  if p_unit_id is null then
    raise exception 'p_unit_id must not be null'
      using errcode = '22023';
  end if;

  select u.army_id into v_army_id from public.army_units u where u.id = p_unit_id for update of u;

  if v_army_id is null then
    raise exception 'unit not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.unit_soldiers s where s.unit_id = p_unit_id) then
    raise exception 'unit must have no soldiers before it can be deleted'
      using errcode = '22023', hint = 'unit_not_empty';
  end if;

  delete from public.army_units where id = p_unit_id;
end;
$$;

revoke all on function public.delete_army_unit (uuid)
from
  public;

grant
execute on function public.delete_army_unit (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Labor exclusion: extend the auto-assignment picking pools (standard job /
-- construction / deposit / husbandry / culling / trade route) to skip
-- soldiers, mirroring the education_enrollments exclusion added alongside
-- these same functions in 20260925000000.
-- ---------------------------------------------------------------------------
create or replace function public.set_bulk_standard_job_assignment (
  p_settlement_id uuid,
  p_job_id uuid,
  p_target_count integer
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id                    uuid;
  v_turn_number                 integer;
  v_job_type                    text;
  v_job_is_trashed              boolean;
  v_required_education_level_id uuid;
  v_required_education_rank     integer;
  v_required_education_name     text;
  v_qualified_count             integer;
  v_capacity                    integer;
  v_current_count               integer;
  v_delta                       integer;
  v_added_ids                   uuid[] := array[]::uuid[];
  v_removed_ids                 uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_settlement_id is null
     or p_job_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Resolve settlement → world
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Load job (must belong to the same world)
  select j.job_type, j.is_trashed, j.required_education_level_id
    into v_job_type, v_job_is_trashed, v_required_education_level_id
    from public.job_definitions j
   where j.id       = p_job_id
     and j.world_id = v_world_id;

  if v_job_type is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_job_is_trashed then
    raise exception 'job is trashed' using errcode = 'P0001';
  end if;

  if v_job_type not in ('standard', 'construction') then
    raise exception 'job type must be standard or construction' using errcode = 'P0001';
  end if;

  -- Capacity check (both standard and construction have base_capacity)
  v_capacity := public.settlement_job_capacity (p_settlement_id, p_job_id);

  if p_target_count > v_capacity then
    raise exception 'target count exceeds settlement job capacity'
      using errcode = 'P0001';
  end if;

  -- Education requirement check: reject a target_count exceeding the
  -- qualified pool (alive, unenrolled, npc citizens in the settlement who
  -- meet the requirement).
  if v_required_education_level_id is not null then
    select rank, name
      into v_required_education_rank, v_required_education_name
      from public.education_levels
     where id = v_required_education_level_id;

    select count (*)::integer
      into v_qualified_count
      from public.citizens c
      join public.education_levels cel on cel.id = c.education_level_id
     where c.settlement_id = p_settlement_id
       and c.status        = 'alive'
       and c.citizen_type  = 'npc'
       and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
       and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
       and cel.rank        >= v_required_education_rank;

    if p_target_count > v_qualified_count then
      raise exception 'Only % citizens meet the education requirement (%)',
        v_qualified_count, v_required_education_name
        using errcode = 'P0001';
    end if;
  end if;

  -- Current world turn number (used when inserting new assignments)
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- Current count depends on job type
  if v_job_type = 'construction' then
    -- Pool count: all construction_project assignments in the settlement
    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
      join public.citizens c on c.id = ca.citizen_id
     where ca.assignment_type = 'construction_project'
       and c.settlement_id    = p_settlement_id;
  else
    -- Standard: count by job_id
    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
      join public.citizens c on c.id = ca.citizen_id
     where ca.assignment_type = 'standard_job'
       and ca.job_id          = p_job_id
       and c.settlement_id    = p_settlement_id;
  end if;

  -- No-op
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  if v_delta > 0 then
    -- Raise: add unassigned alive qualified NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
        left join public.education_levels cel on cel.id = c.education_level_id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
         and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
         and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         and (
           v_required_education_level_id is null
           or (cel.rank is not null and cel.rank >= v_required_education_rank)
         )
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if v_job_type = 'construction' then
      -- Pool members: assignment_type = construction_project, job_id = null
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
          left join public.education_levels cel on cel.id = c.education_level_id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
           and (
             v_required_education_level_id is null
             or (cel.rank is not null and cel.rank >= v_required_education_rank)
           )
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id,
          assignment_type,
          construction_project_id,
          assigned_on_turn_number
        )
        select sn.id, 'construction_project', null, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;
    else
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
          left join public.education_levels cel on cel.id = c.education_level_id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
           and (
             v_required_education_level_id is null
             or (cel.rank is not null and cel.rank >= v_required_education_rank)
           )
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id,
          assignment_type,
          job_id,
          assigned_on_turn_number
        )
        select sn.id, 'standard_job', p_job_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;
    end if;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens in deterministic-random order
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if v_job_type = 'construction' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type = 'construction_project'
             and c.settlement_id    = p_settlement_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;
    else
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type = 'standard_job'
             and ca.job_id          = p_job_id
             and c.settlement_id    = p_settlement_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;
    end if;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_bulk_standard_job_assignment (uuid, uuid, integer)
from
  public;

grant
execute on function public.set_bulk_standard_job_assignment (uuid, uuid, integer) to authenticated;

create or replace function public.set_per_target_bulk_assignment (
  p_settlement_id uuid,
  p_assignment_type text,
  p_target_id uuid,
  p_target_count integer,
  p_trade_route_end text default null
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id          uuid;
  v_turn_number       integer;
  v_target_settlement uuid;
  v_target_status     text;
  v_max_workers       integer;
  v_job_is_trashed    boolean;
  v_current_count     integer;
  v_delta             integer;
  v_added_ids         uuid[] := array[]::uuid[];
  v_removed_ids       uuid[] := array[]::uuid[];
begin
  -- -----------------------------------------------------------------------
  -- Null guard
  -- -----------------------------------------------------------------------
  if p_settlement_id is null
     or p_assignment_type is null
     or p_target_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Non-negative count
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  -- Type validation
  if p_assignment_type not in ('deposit', 'husbandry', 'culling', 'trade_route') then
    raise exception 'assignment type must be deposit, husbandry, culling, or trade_route'
      using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Resolve settlement → world
  -- -----------------------------------------------------------------------
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------------
  -- Authorization
  -- -----------------------------------------------------------------------
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: deposit
  -- Lock deposit_instances row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  if p_assignment_type = 'deposit' then

    select di.settlement_id, di.status, di.max_workers
      into v_target_settlement, v_target_status, v_max_workers
      from public.deposit_instances di
     where di.id = p_target_id
     for update;

    if v_target_settlement is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_settlement <> p_settlement_id then
      raise exception 'deposit instance does not belong to settlement'
        using errcode = 'P0001';
    end if;

    if v_target_status <> 'active' then
      raise exception 'deposit instance status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    if v_max_workers is not null and p_target_count > v_max_workers then
      raise exception 'target count (%) exceeds max workers (%) for this deposit instance',
        p_target_count, v_max_workers
        using errcode = 'P0001';
    end if;

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type     = 'deposit'
       and ca.deposit_instance_id = p_target_id;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: husbandry / culling
  -- Lock managed_population_instances row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  elsif p_assignment_type in ('husbandry', 'culling') then

    select mpi.settlement_id, mpi.status
      into v_target_settlement, v_target_status
      from public.managed_population_instances mpi
     where mpi.id = p_target_id
     for update;

    if v_target_settlement is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_settlement <> p_settlement_id then
      raise exception 'managed population instance does not belong to settlement'
        using errcode = 'P0001';
    end if;

    if v_target_status <> 'active' then
      raise exception 'managed population instance status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    if p_assignment_type = 'husbandry' then
      select j.is_trashed
        into v_job_is_trashed
        from public.managed_population_instances mpi
        join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mpt.husbandry_job_id
       where mpi.id = p_target_id;
    else
      select j.is_trashed
        into v_job_is_trashed
        from public.managed_population_instances mpi
        join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
        join public.job_definitions j on j.id = mpt.culling_job_id
       where mpi.id = p_target_id;
    end if;

    if v_job_is_trashed then
      raise exception 'linked % job is trashed', p_assignment_type
        using errcode = 'P0001';
    end if;

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type                 = p_assignment_type
       and ca.managed_population_instance_id  = p_target_id;

  -- -----------------------------------------------------------------------
  -- Target validation and current-count fetch: trade_route
  -- Lock trade_routes row to prevent concurrent modifications.
  -- -----------------------------------------------------------------------
  elsif p_assignment_type = 'trade_route' then

    if p_trade_route_end is null or p_trade_route_end not in ('origin', 'destination') then
      raise exception 'trade_route_end must be origin or destination'
        using errcode = 'P0001';
    end if;

    select tr.status
      into v_target_status
      from public.trade_routes tr
     where tr.id = p_target_id
       and (
         (p_trade_route_end = 'origin'      and tr.origin_settlement_id      = p_settlement_id)
         or
         (p_trade_route_end = 'destination' and tr.destination_settlement_id = p_settlement_id)
       )
     for update;

    if v_target_status is null then
      if exists (select 1 from public.trade_routes where id = p_target_id) then
        raise exception 'trade route end does not match settlement'
          using errcode = 'P0001';
      end if;
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_target_status <> 'active' then
      raise exception 'trade route status is not active (%)', v_target_status
        using errcode = 'P0001';
    end if;

    select count (*)::integer
      into v_current_count
      from public.citizen_assignments ca
     where ca.assignment_type = 'trade_route'
       and ca.trade_route_id  = p_target_id
       and ca.trade_route_end = p_trade_route_end;

  end if;

  -- -----------------------------------------------------------------------
  -- Current world turn number
  -- -----------------------------------------------------------------------
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- -----------------------------------------------------------------------
  -- No-op
  -- -----------------------------------------------------------------------
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  -- -----------------------------------------------------------------------
  -- Raise: pick unassigned alive NPCs in deterministic-random order
  -- -----------------------------------------------------------------------
  if v_delta > 0 then

    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
         and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
         and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if p_assignment_type = 'deposit' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number
        )
        select sn.id, 'deposit', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'husbandry' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
        )
        select sn.id, 'husbandry', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'culling' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number
        )
        select sn.id, 'culling', p_target_id, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;

    elsif p_assignment_type = 'trade_route' then
      with selected_npcs as (
        select c.id
          from public.citizens c
          left join public.citizen_assignments ca on ca.citizen_id = c.id
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
           and not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
           and not exists (select 1 from public.unit_soldiers us where us.citizen_id = c.id)
         order by random ()
         limit v_delta
      ),
      inserted as (
        insert into public.citizen_assignments (
          citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number
        )
        select sn.id, 'trade_route', p_target_id, p_trade_route_end, v_turn_number
          from selected_npcs sn
        returning citizen_id
      )
      select array_agg (citizen_id order by citizen_id)
        into v_added_ids
        from inserted;
    end if;

    v_removed_ids := array[]::uuid[];

  -- -----------------------------------------------------------------------
  -- Lower: remove assignees in deterministic-random order
  -- -----------------------------------------------------------------------
  else

    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    if p_assignment_type = 'deposit' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type     = 'deposit'
             and ca.deposit_instance_id = p_target_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;

    elsif p_assignment_type in ('husbandry', 'culling') then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type                = p_assignment_type
             and ca.managed_population_instance_id = p_target_id
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;

    elsif p_assignment_type = 'trade_route' then
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
           where ca.assignment_type = 'trade_route'
             and ca.trade_route_id  = p_target_id
             and ca.trade_route_end = p_trade_route_end
           order by random () asc
           limit (v_current_count - p_target_count)
        ) t;
    end if;

    delete from public.citizen_assignments
     where citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_per_target_bulk_assignment (uuid, text, uuid, integer, text)
from
  public;

grant
execute on function public.set_per_target_bulk_assignment (uuid, text, uuid, integer, text) to authenticated;
