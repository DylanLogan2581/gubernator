-- Migration: add_labor_eligibility_to_citizen_directory_view
-- #1322: the settlement Job Assignments unassigned count counted every alive
-- citizen with no citizen_assignments row, without checking whether they
-- could ever actually be assigned. The simulation's real labor-eligibility
-- set (phaseStandardJobs.ts) excludes nation office-holders whose office
-- excludes_from_labor, education enrollees, and soldiers -- none of which
-- the frontend could evaluate from the raw citizens table. Appends three
-- boolean columns so the aggregate query can filter them out client-side.
--
-- CREATE OR REPLACE VIEW only appends columns here -- the existing column
-- list/order from 20261115000000 is untouched, so no dependent breaks.
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
    when 'deposit' then dt.name
    when 'husbandry' then mpt.name
    when 'culling' then mpt.name
    when 'trade_route' then 'Trader'
    when 'construction_project' then 'Construction'
    else null
  end as assignment_label,
  (
    select
      string_agg(
        ot.name,
        ', '
        order by
          ot.name
      )
    from
      public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
    where
      o.citizen_id = c.id
      and o.ended_turn_number is null
  ) as office_types,
  el.name as education_level_name,
  exists (
    select
      1
    from
      public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
    where
      o.citizen_id = c.id
      and o.ended_turn_number is null
      and ot.excludes_from_labor
  ) as is_labor_excluded_officeholder,
  exists (
    select
      1
    from
      public.education_enrollments ee
    where
      ee.citizen_id = c.id
  ) as is_enrolled_in_education,
  exists (
    select
      1
    from
      public.unit_soldiers us
    where
      us.citizen_id = c.id
  ) as is_soldier
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
  left join public.managed_population_instances mpi on mpi.id = ca.managed_population_instance_id
  left join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
  left join public.education_levels el on el.id = c.education_level_id;

grant
select
  on public.citizen_directory_view to authenticated;
