-- Migration: merge_construction_into_bulk_job_counts
-- Extends get_settlement_standard_job_counts to return construction-typed jobs
-- alongside standard jobs so the UI can render one flat list.
-- Extends set_bulk_standard_job_assignment to accept construction-typed jobs,
-- routing them to the existing pool model (assignment_type = 'construction_project',
-- construction_project_id = NULL) internally.
--
-- The construction pool concept becomes implicit: assigning N workers to a
-- construction-typed job IS assigning them to the settlement-wide pool.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 1. get_settlement_standard_job_counts — include construction-typed jobs
-- ---------------------------------------------------------------------------
create or replace function public.get_settlement_standard_job_counts (p_settlement_id uuid) returns table (
  job_id uuid,
  job_name text,
  job_slug text,
  world_id uuid,
  current_count integer,
  capacity integer
) language sql stable security definer
set
  search_path = '' as $$
  select
    j.id    as job_id,
    j.name  as job_name,
    j.slug  as job_slug,
    n.world_id,
    case
      when j.job_type = 'construction' then
        coalesce(
          (
            select count (*)::integer
            from   public.citizen_assignments ca
            join   public.citizens c on c.id = ca.citizen_id
            where  ca.assignment_type = 'construction_project'
              and  c.settlement_id    = p_settlement_id
          ),
          0
        )
      else
        coalesce(
          (
            select count (*)::integer
            from   public.citizen_assignments ca
            join   public.citizens c on c.id = ca.citizen_id
            where  ca.job_id          = j.id
              and  ca.assignment_type = 'standard_job'
              and  c.settlement_id    = p_settlement_id
          ),
          0
        )
    end as current_count,
    public.settlement_job_capacity (p_settlement_id, j.id) as capacity
  from   public.job_definitions j
  join   public.settlements s on s.id  = p_settlement_id
  join   public.nations     n on n.id  = s.nation_id
  where  j.world_id   = n.world_id
    and  j.job_type   in ('standard', 'construction')
    and  j.is_trashed = false
  order by j.name, j.id
$$;

revoke all on function public.get_settlement_standard_job_counts (uuid)
from
  public;

grant
execute on function public.get_settlement_standard_job_counts (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. set_bulk_standard_job_assignment — extend to handle construction jobs
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
  v_world_id       uuid;
  v_turn_number    integer;
  v_job_type       text;
  v_job_is_trashed boolean;
  v_capacity       integer;
  v_current_count  integer;
  v_delta          integer;
  v_added_ids      uuid[] := array[]::uuid[];
  v_removed_ids    uuid[] := array[]::uuid[];
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

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Load job (must belong to the same world)
  select j.job_type, j.is_trashed
    into v_job_type, v_job_is_trashed
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
    -- Raise: add unassigned alive NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
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
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
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
         where c.settlement_id = p_settlement_id
           and c.status        = 'alive'
           and c.citizen_type  = 'npc'
           and ca.citizen_id   is null
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
