-- Migration: add_construction_project_upgrade_building
-- #1372: construction projects can now upgrade an existing settlement_building
-- in place instead of always creating a new building. An upgrade project points
-- at the building being upgraded via upgrade_settlement_building_id; on
-- completion the simulation bumps that building's current_tier_id rather than
-- inserting a new row.
--
-- Behaviour decision (documented): the building stays active at its current
-- tier for the whole duration of the upgrade — its row is untouched until the
-- project completes, so its effects keep applying at the old tier until the
-- upgrade lands.
-- ---------------------------------------------------------------------------
alter table public.construction_projects
add column upgrade_settlement_building_id uuid references public.settlement_buildings (id) on delete cascade;

comment on column public.construction_projects.upgrade_settlement_building_id is 'When set, this project upgrades the referenced settlement_building in place (bumps current_tier_id on completion) instead of creating a new building. Null for direct-build projects.';

create index construction_projects_upgrade_building_id_idx on public.construction_projects (upgrade_settlement_building_id);

-- At most one in-flight upgrade per building.
create unique index construction_projects_active_upgrade_idx on public.construction_projects (upgrade_settlement_building_id)
where
  status in ('queued', 'in_progress', 'paused')
  and upgrade_settlement_building_id is not null;

-- ---------------------------------------------------------------------------
-- Refresh the max-instances trigger so upgrade projects are exempt: an upgrade
-- does not add a building instance, so it must neither be blocked by the cap
-- nor counted toward it.
-- ---------------------------------------------------------------------------
create or replace function public.check_construction_project_max_instances () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_max          integer;
  v_active_count integer;
begin
  -- Only enforce the cap for non-terminal inserts.
  if new.status not in ('queued', 'in_progress', 'paused') then
    return new;
  end if;

  -- Upgrade projects reuse an existing building instance; they are exempt.
  if new.upgrade_settlement_building_id is not null then
    return new;
  end if;

  select max_instances_per_settlement
  into v_max
  from public.building_blueprints
  where id = new.building_blueprint_id;

  if v_max is null then
    return new;
  end if;

  -- The new row does not exist yet, so no self-exclusion is needed. Upgrade
  -- projects are excluded from the count for the same reason they are exempt.
  select count(*)
  into v_active_count
  from public.construction_projects
  where settlement_id = new.settlement_id
    and building_blueprint_id = new.building_blueprint_id
    and upgrade_settlement_building_id is null
    and status in ('queued', 'in_progress', 'paused');

  if v_active_count >= v_max then
    raise exception
      'settlement has reached the maximum number of in-flight construction projects for this blueprint (limit: %)',
      v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
