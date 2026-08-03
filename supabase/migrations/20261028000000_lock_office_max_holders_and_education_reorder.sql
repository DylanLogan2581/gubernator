-- Migration: lock_office_max_holders_and_education_reorder
-- #1150: two count/swap-then-write RPCs lacked row locks, so concurrent
-- calls could interleave:
--   - appoint_nation_office / appoint_settlement_office max_holders
--     enforcement was count-then-insert -- concurrent appoints could exceed
--     max_holders.
--   - reorder_education_level swapped via scratch rank -1 with no locking --
--     concurrent reorders in the same world could collide on the scratch
--     rank and fail with a raw unique violation.
-- Fix: `for update` locks the nations/settlements row before counting, and
-- both education-level rows before swapping. No behavior change for
-- sequential callers; error contracts unchanged.
--
-- Bodies copied verbatim from 20261009000001_add_office_terms.sql (latest
-- definition of the office functions) and 20260921000000_add_education_levels.sql
-- (only -- and still latest -- definition of reorder_education_level), with
-- only the lock added.
-- ---------------------------------------------------------------------------
create or replace function public.appoint_nation_office (
  p_nation_id uuid,
  p_office_type text,
  p_citizen_id uuid,
  p_term_turns integer default null
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_government_type text;
  v_office_type_id uuid;
  v_office_type_nation_id uuid;
  v_max_holders integer;
  v_current_holders integer;
  v_office_allowed boolean;
  v_citizen_status text;
  v_citizen_nation_id uuid;
  v_row public.nation_offices%rowtype;
begin
  if p_nation_id is null or p_office_type is null or p_citizen_id is null then
    raise exception 'nation, office type, and citizen are required'
      using errcode = '22023';
  end if;

  if p_term_turns is not null and p_term_turns <= 0 then
    raise exception 'p_term_turns must be positive'
      using errcode = '22023', hint = 'invalid_term_turns';
  end if;

  select n.world_id, w.status, w.current_turn_number, n.government_type
  into v_world_id, v_world_status, v_turn_number, v_government_type
  from public.nations n
  inner join public.worlds w on w.id = n.world_id
  where n.id = p_nation_id;

  if v_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select ot.id, ot.nation_id, ot.max_holders
  into v_office_type_id, v_office_type_nation_id, v_max_holders
  from public.office_types ot
  where ot.world_id = v_world_id
    and (
      ot.nation_id = p_nation_id
      or ot.nation_id is null
    )
    and ot.name = p_office_type
    and ot.scope = 'nation'
  order by ot.nation_id nulls last
  limit 1;

  if v_office_type_id is null then
    raise exception 'office type % not found for this nation', p_office_type
      using errcode = '22023', hint = 'office_type_not_found';
  end if;

  if v_office_type_nation_id is null then
    v_office_allowed := (
      case v_government_type
        when 'monarchy' then p_office_type in ('chancellor', 'treasurer', 'bank_governor')
        when 'republic' then p_office_type in ('senator', 'treasurer', 'bank_governor')
        when 'theocracy' then p_office_type in ('clergy', 'treasurer', 'bank_governor')
        when 'tribal_council' then p_office_type in ('elder', 'treasurer', 'bank_governor')
        when 'confederation' then p_office_type in ('delegate', 'treasurer', 'bank_governor')
        when 'despotism' then p_office_type in ('chancellor', 'treasurer', 'bank_governor')
        else false
      end
    );

    if not v_office_allowed then
      raise exception 'office type % is not allowed for government type %', p_office_type, v_government_type
        using errcode = '22023', hint = 'office_type_not_allowed';
    end if;
  end if;

  if v_max_holders is not null then
    -- #1150: lock the nation row so concurrent appoints against it serialize
    -- instead of both reading the same pre-insert count.
    perform 1 from public.nations where id = p_nation_id for update;

    select count(*)
    into v_current_holders
    from public.nation_offices
    where nation_id = p_nation_id
      and office_type_id = v_office_type_id
      and ended_turn_number is null;

    if v_current_holders >= v_max_holders then
      raise exception 'office type % already has the maximum number of holders', p_office_type
        using errcode = '22023', hint = 'office_type_max_holders';
    end if;
  end if;

  select c.status, s.nation_id
  into v_citizen_status, v_citizen_nation_id
  from public.citizens c
  left join public.settlements s on s.id = c.settlement_id
  where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'citizen not found'
      using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen must be alive to hold a nation office'
      using errcode = '22023', hint = 'citizen_not_alive';
  end if;

  if v_citizen_nation_id is null or v_citizen_nation_id <> p_nation_id then
    raise exception 'citizen must belong to a settlement of this nation'
      using errcode = '22023', hint = 'citizen_not_in_nation';
  end if;

  begin
    insert into public.nation_offices (
      world_id,
      nation_id,
      office_type_id,
      citizen_id,
      appointed_turn_number,
      term_turns,
      expires_turn_number
    )
    values (
      v_world_id, p_nation_id, v_office_type_id, p_citizen_id, v_turn_number,
      p_term_turns,
      case when p_term_turns is null then null else v_turn_number + p_term_turns end
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- appoint_settlement_office: mirrors the lock added above.
-- ---------------------------------------------------------------------------
create or replace function public.appoint_settlement_office (
  p_settlement_id uuid,
  p_office_type text,
  p_citizen_id uuid,
  p_term_turns integer default null
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_office_type_id uuid;
  v_max_holders integer;
  v_current_holders integer;
  v_citizen_status text;
  v_citizen_settlement_id uuid;
  v_row public.nation_offices%rowtype;
begin
  if p_settlement_id is null or p_office_type is null or p_citizen_id is null then
    raise exception 'settlement, office type, and citizen are required'
      using errcode = '22023';
  end if;

  if p_term_turns is not null and p_term_turns <= 0 then
    raise exception 'p_term_turns must be positive'
      using errcode = '22023', hint = 'invalid_term_turns';
  end if;

  select n.world_id, s.nation_id, w.status, w.current_turn_number
  into v_world_id, v_nation_id, v_world_status, v_turn_number
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  inner join public.worlds w on w.id = n.world_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'settlement not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select ot.id, ot.max_holders
  into v_office_type_id, v_max_holders
  from public.office_types ot
  where ot.world_id = v_world_id
    and (
      ot.nation_id = v_nation_id
      or ot.nation_id is null
    )
    and ot.name = p_office_type
    and ot.scope = 'settlement'
  order by ot.nation_id nulls last
  limit 1;

  if v_office_type_id is null then
    raise exception 'office type % not found for this settlement', p_office_type
      using errcode = '22023', hint = 'office_type_not_found';
  end if;

  if v_max_holders is not null then
    -- #1150: lock the settlement row so concurrent appoints against it
    -- serialize instead of both reading the same pre-insert count.
    perform 1 from public.settlements where id = p_settlement_id for update;

    select count(*)
    into v_current_holders
    from public.nation_offices
    where settlement_id = p_settlement_id
      and office_type_id = v_office_type_id
      and ended_turn_number is null;

    if v_current_holders >= v_max_holders then
      raise exception 'office type % already has the maximum number of holders', p_office_type
        using errcode = '22023', hint = 'office_type_max_holders';
    end if;
  end if;

  select c.status, c.settlement_id
  into v_citizen_status, v_citizen_settlement_id
  from public.citizens c
  where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'citizen not found'
      using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen must be alive to hold a settlement office'
      using errcode = '22023', hint = 'citizen_not_alive';
  end if;

  if v_citizen_settlement_id is null or v_citizen_settlement_id <> p_settlement_id then
    raise exception 'citizen must be a resident of this settlement'
      using errcode = '22023', hint = 'citizen_not_resident';
  end if;

  begin
    insert into public.nation_offices (
      world_id,
      settlement_id,
      office_type_id,
      citizen_id,
      appointed_turn_number,
      term_turns,
      expires_turn_number
    )
    values (
      v_world_id, p_settlement_id, v_office_type_id, p_citizen_id, v_turn_number,
      p_term_turns,
      case when p_term_turns is null then null else v_turn_number + p_term_turns end
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- reorder_education_level: lock both the target and neighbor rows (ordered
-- by id, so two concurrent swaps that touch overlapping rows always
-- acquire locks in the same order and can't deadlock) before the scratch-
-- rank swap.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_education_level (p_level_id uuid, p_direction text) returns setof public.education_levels language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id      uuid;
  v_rank          integer;
  v_neighbor_id   uuid;
  v_neighbor_rank integer;
begin
  if p_level_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id, rank into v_world_id, v_rank
  from public.education_levels
  where id = p_level_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.' using errcode = '22023';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = 'P0001';
  end if;

  if p_direction = 'up' then
    select id, rank into v_neighbor_id, v_neighbor_rank
    from public.education_levels
    where world_id = v_world_id
      and rank < v_rank
    order by rank desc
    limit 1;
  else
    select id, rank into v_neighbor_id, v_neighbor_rank
    from public.education_levels
    where world_id = v_world_id
      and rank > v_rank
    order by rank asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    raise exception 'no adjacent level to swap with' using errcode = 'P0001';
  end if;

  -- #1150: lock both rows (id order, not swap order) before mutating so
  -- concurrent reorders touching either row serialize instead of both
  -- landing on the scratch rank -1 at once.
  perform 1
  from public.education_levels
  where id in (p_level_id, v_neighbor_id)
  order by id
  for update;

  update public.education_levels set rank = -1 where id = p_level_id;
  update public.education_levels set rank = v_rank where id = v_neighbor_id;
  update public.education_levels set rank = v_neighbor_rank where id = p_level_id;

  return query
  select * from public.education_levels
  where id in (p_level_id, v_neighbor_id);
end;
$$;
