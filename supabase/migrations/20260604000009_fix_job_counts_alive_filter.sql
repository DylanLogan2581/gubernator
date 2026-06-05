-- Migration: fix_job_counts_alive_filter
-- Defense-in-depth: filter citizen rows to status = 'alive' inside
-- get_settlement_standard_job_counts so that any stale assignment rows
-- belonging to dead citizens do not inflate the displayed Assigned count.
-- The primary fix (runSimulation.ts emitting assignmentClears for p8/p10
-- deaths) ensures those rows are deleted during apply_turn_transition;
-- this filter is a fallback against future gaps in that path.
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
