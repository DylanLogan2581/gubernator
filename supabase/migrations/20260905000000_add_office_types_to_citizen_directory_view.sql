-- Migration: add_office_types_to_citizen_directory_view
-- #1081: officeholders leave the settlement labor pool. The assignment UI
-- needs to mark a citizen who holds any nation_offices row so it can render
-- an "In office: <office_type>" badge instead of the normal job/assignment
-- label. Appends office_types (comma-separated, alphabetical) as a scalar
-- subquery rather than a join, since a citizen may hold more than one office
-- (nation_offices_unique is per office_type) and a join would fan out rows.
--
-- CREATE OR REPLACE VIEW only appends a column here — the existing column
-- list/order from 20260818000000 is untouched, so no dependent breaks.
-- ---------------------------------------------------------------------------
create or replace view public.citizen_directory_view
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
  end as assignment_label,
  (
    select
      string_agg(
        o.office_type,
        ', '
        order by
          o.office_type
      )
    from
      public.nation_offices o
    where
      o.citizen_id = c.id
  ) as office_types
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
