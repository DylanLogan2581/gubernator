-- Migration: gate_settlement_standard_job_counts_world_access
-- #1140: get_settlement_standard_job_counts is SECURITY DEFINER and granted
-- to authenticated with no authorization check on p_settlement_id, so any
-- authenticated user in any world could read job counts, capacities,
-- education requirements, and qualified-citizen counts for a settlement in
-- any other world -- bypassing RLS on citizens/citizen_assignments/
-- job_definitions.
--
-- Fix: resolve the settlement's world and require
-- public.current_user_has_world_access(n.world_id), raising 42501
-- otherwise. The query body is unchanged from the 20260927000000
-- definition; the function is rewritten from `language sql` to `language
-- plpgsql` because the access check must run before the result set is
-- built, and a plain SQL function cannot branch/raise.
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
) language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_has_world_access (v_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
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
  order by j.name, j.id;
end;
$$;

revoke all on function public.get_settlement_standard_job_counts (uuid)
from
  public;

grant
execute on function public.get_settlement_standard_job_counts (uuid) to authenticated;
