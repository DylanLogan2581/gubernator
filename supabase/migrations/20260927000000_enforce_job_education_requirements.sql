-- Migration: enforce_job_education_requirements
-- #1105: jobs with a required_education_level_id must only be filled by
-- citizens whose education level rank meets or exceeds it. Assignment is
-- count-based with automatic citizen picking, so enforcement means:
--   1. set_bulk_standard_job_assignment rejects a target_count that exceeds
--      the qualified pool (alive, unenrolled, npc citizens in the settlement
--      who meet the requirement) with a clear error, and only ever picks
--      qualified citizens when raising.
--   2. get_settlement_standard_job_counts surfaces the requirement + the
--      qualified-pool size so the UI can render a badge and clamp input.
--   3. phaseStandardJobs (simulation) is extended separately in TS -- see
--      supabase/functions/_shared/simulation/phases/phaseStandardJobs.ts.
--
-- get_settlement_standard_job_counts changes its OUT column list, which
-- Postgres does not allow via CREATE OR REPLACE FUNCTION alone -- the
-- function must be dropped first.
-- ---------------------------------------------------------------------------
drop function public.get_settlement_standard_job_counts (uuid);

create function public.get_settlement_standard_job_counts (p_settlement_id uuid) returns table (
  job_id uuid,
  job_name text,
  job_slug text,
  world_id uuid,
  current_count integer,
  capacity integer,
  required_education_level_id uuid,
  required_education_level_name text,
  qualified_citizen_count integer
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
              and  c.status           = 'alive'
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
              and  c.status           = 'alive'
          ),
          0
        )
    end as current_count,
    public.settlement_job_capacity (p_settlement_id, j.id) as capacity,
    j.required_education_level_id,
    rel.name as required_education_level_name,
    coalesce(
      (
        select count (*)::integer
        from   public.citizens c
        left join public.education_levels cel on cel.id = c.education_level_id
        where  c.settlement_id  = p_settlement_id
          and  c.status         = 'alive'
          and  c.citizen_type   = 'npc'
          and  not exists (select 1 from public.education_enrollments ee where ee.citizen_id = c.id)
          and  (
            j.required_education_level_id is null
            or (cel.rank is not null and cel.rank >= rel.rank)
          )
      ),
      0
    ) as qualified_citizen_count
  from   public.job_definitions j
  join   public.settlements s on s.id  = p_settlement_id
  join   public.nations     n on n.id  = s.nation_id
  left join public.education_levels rel on rel.id = j.required_education_level_id
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
-- set_bulk_standard_job_assignment -- redefined in full from its latest
-- prior definition (20260925000000), adding education-requirement
-- enforcement: a capacity-like reject when p_target_count exceeds the
-- qualified pool, and a qualification filter added to every unassigned-NPC
-- selection query alongside the existing enrollment exclusion.
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
