-- Migration: unique_active_job_links
-- Replaces the unconditional UNIQUE constraints on deposit_types.job_id and
-- managed_population_types.husbandry_job_id / culling_job_id with partial
-- unique indexes scoped to active (non-trashed) rows.
--
-- Motivation: the old constraints block job reuse after a soft-delete. With
-- partial indexes, a job can be relinked once its previous owner is trashed.
-- The client-side duplicate check already enforces this rule for active types;
-- these indexes enforce it at the database level to prevent concurrent races.
-- ---------------------------------------------------------------------------
-- deposit_types -----------------------------------------------------------
alter table public.deposit_types
drop constraint deposit_types_job_id_unique;

create unique index deposit_types_unique_active_job_id on public.deposit_types (job_id)
where
  is_active;

-- managed_population_types ------------------------------------------------
alter table public.managed_population_types
drop constraint managed_population_types_husbandry_job_id_unique,
drop constraint managed_population_types_culling_job_id_unique;

create unique index managed_population_types_unique_active_husbandry_job_id on public.managed_population_types (husbandry_job_id)
where
  is_active;

create unique index managed_population_types_unique_active_culling_job_id on public.managed_population_types (culling_job_id)
where
  is_active;
