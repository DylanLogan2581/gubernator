-- Migration: plain_indexes_job_link_columns
-- Adds plain (non-partial) b-tree indexes on job-link foreign key columns in
-- deposit_types and managed_population_types.
--
-- The partial unique indexes added in 20260530000011 are scoped to is_active = true,
-- so full-table queries (e.g. trash UI showing inactive references) had no index
-- support and fell back to sequential scans. These plain indexes cover all rows.
-- ---------------------------------------------------------------------------
create index deposit_types_job_id_idx on public.deposit_types using btree (job_id);

create index managed_population_types_husbandry_job_id_idx on public.managed_population_types using btree (husbandry_job_id);

create index managed_population_types_culling_job_id_idx on public.managed_population_types using btree (culling_job_id);
