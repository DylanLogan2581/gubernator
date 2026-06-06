-- Migration: extend_catalog_select_rls_pc_path
-- Replaces has_world_access with current_user_has_world_access on the SELECT
-- policies for the Epic 4 catalog tables: resources, job_definitions,
-- deposit_types, managed_population_types, building_blueprints, and
-- building_blueprint_tiers.
--
-- has_world_access covers: world owner, explicit world_admin, public world,
-- and super admin.  It does NOT include the player-character path that
-- current_user_has_world_access adds, so in a private world a Nation Manager
-- or Settlement Manager could not read the catalogs required to render their
-- settlement / nation detail pages.
--
-- Write policies (INSERT / UPDATE / DELETE) are unchanged; those remain
-- gated on is_world_admin / is_super_admin.
-- ---------------------------------------------------------------------------
drop policy "resources_select_world_access" on public.resources;

create policy "resources_select_world_access" on public.resources for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- ---------------------------------------------------------------------------
drop policy "job_definitions_select_world_access" on public.job_definitions;

create policy "job_definitions_select_world_access" on public.job_definitions for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- ---------------------------------------------------------------------------
drop policy "deposit_types_select_world_access" on public.deposit_types;

create policy "deposit_types_select_world_access" on public.deposit_types for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- ---------------------------------------------------------------------------
drop policy "managed_population_types_select_world_access" on public.managed_population_types;

create policy "managed_population_types_select_world_access" on public.managed_population_types for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- ---------------------------------------------------------------------------
drop policy "building_blueprints_select_world_access" on public.building_blueprints;

create policy "building_blueprints_select_world_access" on public.building_blueprints for
select
  to authenticated using (public.current_user_has_world_access (world_id));

-- ---------------------------------------------------------------------------
-- building_blueprint_tiers: world context is resolved by joining to the
-- parent building_blueprints row, same as before.
-- ---------------------------------------------------------------------------
drop policy "building_blueprint_tiers_select_world_access" on public.building_blueprint_tiers;

create policy "building_blueprint_tiers_select_world_access" on public.building_blueprint_tiers for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.building_blueprints bb
      where
        bb.id = building_blueprint_id
        and public.current_user_has_world_access (bb.world_id)
    )
  );
