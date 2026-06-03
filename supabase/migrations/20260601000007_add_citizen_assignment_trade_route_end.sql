-- Migration: add_citizen_assignment_trade_route_end
-- Adds trade_route_end to citizen_assignments to disambiguate which end of a
-- trade route (origin vs destination) a citizen is serving. Updates the shape
-- check constraint to require the column when assignment_type = 'trade_route'
-- and enforce null for all other types. A BEFORE trigger validates that the
-- citizen's settlement matches the nominated endpoint settlement.
-- ---------------------------------------------------------------------------
-- Add the discriminator column (nullable; required only for trade_route type).
alter table public.citizen_assignments
add column trade_route_end text;

-- Replace the shape check with a version that incorporates trade_route_end.
alter table public.citizen_assignments
drop constraint citizen_assignments_target_shape_check;

alter table public.citizen_assignments
add constraint citizen_assignments_target_shape_check check (
  (
    assignment_type = 'standard_job'
    and job_id is not null
    and construction_project_id is null
    and deposit_instance_id is null
    and managed_population_instance_id is null
    and trade_route_id is null
    and trade_route_end is null
  )
  or (
    assignment_type = 'construction_project'
    and construction_project_id is not null
    and deposit_instance_id is null
    and managed_population_instance_id is null
    and trade_route_id is null
    and trade_route_end is null
  )
  or (
    assignment_type = 'deposit'
    and deposit_instance_id is not null
    and construction_project_id is null
    and managed_population_instance_id is null
    and trade_route_id is null
    and trade_route_end is null
  )
  or (
    assignment_type in ('husbandry', 'culling')
    and managed_population_instance_id is not null
    and construction_project_id is null
    and deposit_instance_id is null
    and trade_route_id is null
    and trade_route_end is null
  )
  or (
    assignment_type = 'trade_route'
    and trade_route_id is not null
    and trade_route_end in ('origin', 'destination')
    and construction_project_id is null
    and deposit_instance_id is null
    and managed_population_instance_id is null
  )
);

-- ---------------------------------------------------------------------------
-- Trigger: validate trade_route_end against the citizen's settlement.
-- When assignment_type = 'trade_route' and trade_route_end = 'origin', the
-- citizen's settlement must be the route's origin_settlement_id; for
-- 'destination' it must be the destination_settlement_id.
-- ---------------------------------------------------------------------------
create or replace function public.check_citizen_assignment_trade_route_end () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen_settlement_id  uuid;
  v_expected_settlement_id uuid;
begin
  select c.settlement_id
  into v_citizen_settlement_id
  from public.citizens c
  where c.id = new.citizen_id;

  if new.trade_route_end = 'origin' then
    select tr.origin_settlement_id
    into v_expected_settlement_id
    from public.trade_routes tr
    where tr.id = new.trade_route_id;
  else
    select tr.destination_settlement_id
    into v_expected_settlement_id
    from public.trade_routes tr
    where tr.id = new.trade_route_id;
  end if;

  -- If the trade_route row does not exist, let the FK constraint raise 23503.
  if v_expected_settlement_id is null then
    return new;
  end if;

  if v_citizen_settlement_id is distinct from v_expected_settlement_id then
    raise exception
      'trade_route_end mismatch: citizen settlement does not match the % endpoint of trade route %',
      new.trade_route_end, new.trade_route_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger citizen_assignments_check_trade_route_end before insert
or
update on public.citizen_assignments for each row when (new.assignment_type = 'trade_route')
execute function public.check_citizen_assignment_trade_route_end ();

comment on column public.citizen_assignments.trade_route_end is 'Which end of the trade route the citizen serves: ''origin'' or ''destination''. Required when assignment_type = ''trade_route''; null for all other types. Validated by trigger against the citizen''s settlement_id.';
