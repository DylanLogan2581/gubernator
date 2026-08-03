-- Migration: add_citizen_education_level
-- #1100: citizens need an education level to gate jobs and progress through
-- schools. Null means uneducated (below every level) -- no default value, no
-- backfill required. Existing worlds bootstrap the first teachers via the
-- world-admin-only bulk RPC below.
-- ---------------------------------------------------------------------------
alter table public.citizens
add column education_level_id uuid references public.education_levels (id) on delete set null;

create index citizens_education_level_id_idx on public.citizens (education_level_id);

-- citizens' column-level SELECT grant to authenticated is an explicit column
-- list (20260611000003_restrict_citizen_npc_visibility) that does not extend
-- to new columns automatically -- without this, citizen_directory_view (which
-- joins education_levels through this column) and any direct table read of
-- it would fail with "permission denied for table citizens" for every
-- non-owner role.
grant
select
  (education_level_id) on public.citizens to authenticated;

-- ---------------------------------------------------------------------------
-- §1: set_citizen_education -- single-citizen admin edit. Null clears the
-- field back to uneducated.
-- ---------------------------------------------------------------------------
create or replace function public.set_citizen_education (p_citizen_id uuid, p_education_level_id uuid) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select world_id into v_world_id from public.citizens where id = p_citizen_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage this citizen.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_education_level_id is not null and not exists (
    select 1 from public.education_levels where id = p_education_level_id and world_id = v_world_id
  ) then
    raise exception 'Education level does not belong to this citizen''s world.'
      using errcode = 'P0001';
  end if;

  return query
  update public.citizens
  set
    education_level_id = p_education_level_id
  where
    id = p_citizen_id
  returning *;
end;
$$;

revoke all on function public.set_citizen_education (uuid, uuid)
from
  public;

grant
execute on function public.set_citizen_education (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- §2: bulk_set_citizen_education -- world-admin-only bootstrap tool. Sets
-- every alive citizen in the settlement to the given level (null is a valid
-- target -- bulk-resets a settlement back to uneducated).
-- ---------------------------------------------------------------------------
create or replace function public.bulk_set_citizen_education (p_settlement_id uuid, p_education_level_id uuid) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select n.world_id into v_world_id
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'Settlement not found.' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage citizens in this settlement.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_education_level_id is not null and not exists (
    select 1 from public.education_levels where id = p_education_level_id and world_id = v_world_id
  ) then
    raise exception 'Education level does not belong to this settlement''s world.'
      using errcode = 'P0001';
  end if;

  return query
  update public.citizens
  set
    education_level_id = p_education_level_id
  where
    settlement_id = p_settlement_id
    and status = 'alive'
  returning *;
end;
$$;

revoke all on function public.bulk_set_citizen_education (uuid, uuid)
from
  public;

grant
execute on function public.bulk_set_citizen_education (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- §3: citizen_directory_view -- append education_level_name so list rows can
-- render an education badge without a per-row lookup. CREATE OR REPLACE VIEW
-- only appends a column here -- the existing column list/order is untouched.
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
  ) as office_types,
  el.name as education_level_name
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
  left join public.job_definitions jd_culling on jd_culling.id = mpt.culling_job_id
  left join public.education_levels el on el.id = c.education_level_id;

grant
select
  on public.citizen_directory_view to authenticated;
