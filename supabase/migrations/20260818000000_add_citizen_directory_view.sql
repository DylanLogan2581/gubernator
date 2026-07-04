-- Migration: add_citizen_directory_view
-- World-level citizen directory (#989): a security-invoker view joining
-- citizens with settlement/nation names, age in turns, and a human-readable
-- assignment label, so the frontend can filter and paginate server-side
-- instead of fetching every citizen in the world to the client.
--
-- security_invoker = true means the view runs with the querying user's own
-- privileges — citizens_select_visible RLS (20260817000000) and the
-- NPC-flavor column-level grants (20260611000003) still apply row-for-row
-- and column-for-column; the view exposes no citizens column beyond what
-- that policy/grant already allows.
--
-- citizen_assignments.citizen_id is a primary key (20260520000001), so the
-- assignment join is at most one row per citizen — no fan-out.
-- ---------------------------------------------------------------------------
create view public.citizen_directory_view
with
  (security_invoker = true) as
select
  c.id,
  c.world_id,
  c.name,
  c.sex,
  c.status,
  c.citizen_type,
  c.born_on_turn_number,
  w.current_turn_number - c.born_on_turn_number as age_turns,
  c.settlement_id,
  s.name as settlement_name,
  s.nation_id,
  n.name as nation_name,
  ca.assignment_type,
  case ca.assignment_type
    when 'standard_job' then jd_standard.name
    when 'deposit' then jd_deposit.name
    when 'husbandry' then jd_husbandry.name
    when 'culling' then jd_culling.name
    when 'trade_route' then 'Trader'
    when 'construction_project' then 'Construction'
    else null
  end as assignment_label
from
  public.citizens c
  join public.worlds w on w.id = c.world_id
  left join public.settlements s on s.id = c.settlement_id
  left join public.nations n on n.id = s.nation_id
  left join public.citizen_assignments ca on ca.citizen_id = c.id
  left join public.job_definitions jd_standard on jd_standard.id = ca.job_id
  and ca.assignment_type = 'standard_job'
  left join public.deposit_instances di on di.id = ca.deposit_instance_id
  left join public.deposit_types dt on dt.id = di.deposit_type_id
  left join public.job_definitions jd_deposit on jd_deposit.id = dt.job_id
  left join public.managed_population_instances mpi on mpi.id = ca.managed_population_instance_id
  left join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
  left join public.job_definitions jd_husbandry on jd_husbandry.id = mpt.husbandry_job_id
  left join public.job_definitions jd_culling on jd_culling.id = mpt.culling_job_id;

grant
select
  on public.citizen_directory_view to authenticated;
