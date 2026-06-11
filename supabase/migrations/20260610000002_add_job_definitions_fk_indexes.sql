-- Migration: add_job_definitions_fk_indexes
-- Adds partial b-tree covering indexes for FK reverse lookups on job_definitions.
-- Prevents full table scans when deleting deposit_types or managed_population_types
-- (constraint check for ON DELETE NO ACTION).
-- Refs: #694 (DB-L7)
-- Partial index on linked_deposit_type_id. WHERE clause covers only rows with
-- actual FK references (NULL values don't participate in FK constraint checks).
create index job_definitions_linked_deposit_type_id_idx on public.job_definitions (linked_deposit_type_id)
where
  linked_deposit_type_id is not null;

-- Partial index on linked_managed_population_type_id. WHERE clause covers only rows
-- with actual FK references.
create index job_definitions_linked_managed_population_type_id_idx on public.job_definitions (linked_managed_population_type_id)
where
  linked_managed_population_type_id is not null;
