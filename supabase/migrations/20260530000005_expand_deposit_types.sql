-- Migration: expand_deposit_types
-- Expands the public.deposit_types stub (introduced in add_job_definitions) with
-- the full Epic 4 schema: name, slug, is_active, output_units_per_worker,
-- worker_inputs_json, and a one-to-one link to a deposit-typed job_definition.
-- ---------------------------------------------------------------------------
-- SAFE-EMPTY CONTRACT
-- Several columns below are NOT NULL without a DEFAULT.  This is intentional
-- and safe *only* because public.deposit_types is a stub with no insert RPCs:
-- it contained nothing except system columns (id, world_id, created_at,
-- updated_at) when this migration runs.  Valid temporary defaults are
-- impossible:
--   • name / slug  — DEFAULT '' would violate the char_length >= 1 check.
--   • job_id       — any synthetic UUID would fail the FK to job_definitions
--                    (checked at transaction end even with DEFERRABLE).
--   • output_units_per_worker — DEFAULT 0 violates the > 0 check.
-- If this migration is ever applied to a non-empty table it will fail loudly
-- rather than silently corrupt data; that outcome is intentional.
-- ---------------------------------------------------------------------------
alter table public.deposit_types
add column name text not null,
add column slug text not null,
add column job_id uuid not null,
add column output_units_per_worker integer not null,
add column worker_inputs_json jsonb not null default '[]',
add column is_active boolean not null default true,
add constraint deposit_types_world_slug_unique unique (world_id, slug),
add constraint deposit_types_name_length_check check (char_length(btrim(name)) >= 1),
add constraint deposit_types_name_max_length_check check (char_length(name) <= 64),
add constraint deposit_types_slug_length_check check (char_length(btrim(slug)) >= 1),
add constraint deposit_types_slug_max_length_check check (char_length(slug) <= 64),
add constraint deposit_types_output_units_check check (output_units_per_worker > 0),
add constraint deposit_types_job_id_unique unique (job_id),
add constraint deposit_types_job_id_fk foreign key (job_id) references public.job_definitions (id) deferrable initially deferred;
