-- Migration: expand_managed_population_types
-- Expands the public.managed_population_types stub (introduced in
-- add_job_definitions) with the full Epic 4 schema: name, slug, is_active,
-- husbandry_job_id, culling_job_id, husbandry_workers_per_n_animals,
-- growth_rate, maintenance_rules_json, and culling_outputs_json.
-- Enforces distinct one-to-one links to husbandry and culling job_definitions
-- via UNIQUE constraints and a collision CHECK.
-- ---------------------------------------------------------------------------
-- SAFE-EMPTY CONTRACT
-- Several columns below are NOT NULL without a DEFAULT.  This is intentional
-- and safe *only* because public.managed_population_types is a stub with no
-- insert RPCs: it contained nothing except system columns (id, world_id,
-- created_at, updated_at) when this migration runs.  Valid temporary defaults
-- are impossible:
--   • name / slug              — DEFAULT '' would violate char_length >= 1 check.
--   • husbandry_job_id /
--     culling_job_id           — any synthetic UUID would fail the FK to
--                                job_definitions (checked at txn end even with
--                                DEFERRABLE) and the distinct-jobs CHECK.
--   • husbandry_workers_per_n_animals — DEFAULT 0 violates the > 0 check.
-- If this migration is ever applied to a non-empty table it will fail loudly
-- rather than silently corrupt data; that outcome is intentional.
-- ---------------------------------------------------------------------------
alter table public.managed_population_types
add column name text not null,
add column slug text not null,
add column is_active boolean not null default true,
add column husbandry_job_id uuid not null,
add column culling_job_id uuid not null,
add column husbandry_workers_per_n_animals integer not null,
add column growth_rate numeric not null default 0,
add column maintenance_rules_json jsonb not null default '[]',
add column culling_outputs_json jsonb not null default '[]',
add constraint managed_population_types_world_slug_unique unique (world_id, slug),
add constraint managed_population_types_name_length_check check (char_length(btrim(name)) >= 1),
add constraint managed_population_types_name_max_length_check check (char_length(name) <= 64),
add constraint managed_population_types_slug_length_check check (char_length(btrim(slug)) >= 1),
add constraint managed_population_types_slug_max_length_check check (char_length(slug) <= 64),
add constraint managed_population_types_husbandry_workers_check check (husbandry_workers_per_n_animals > 0),
add constraint managed_population_types_growth_rate_check check (growth_rate >= 0),
add constraint managed_population_types_husbandry_job_id_unique unique (husbandry_job_id),
add constraint managed_population_types_culling_job_id_unique unique (culling_job_id),
add constraint managed_population_types_distinct_jobs_check check (husbandry_job_id <> culling_job_id),
add constraint managed_population_types_husbandry_job_fk foreign key (husbandry_job_id) references public.job_definitions (id) deferrable initially deferred,
add constraint managed_population_types_culling_job_fk foreign key (culling_job_id) references public.job_definitions (id) deferrable initially deferred;
