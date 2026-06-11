-- Migration: add_citizen_assignments_fk_indexes
-- Adds b-tree indexes on the five FK columns of citizen_assignments table.
-- These columns are used in cascade delete operations and job-count aggregations;
-- without indexes, these operations seq-scan the entire table.
-- ---------------------------------------------------------------------------
-- Index on job_id (ON DELETE RESTRICT). Used in job-count aggregations and job updates.
create index citizen_assignments_job_id_idx on public.citizen_assignments (job_id)
where
  job_id is not null;

-- Index on construction_project_id (ON DELETE CASCADE). Used in cascade deletes and aggregations.
create index citizen_assignments_construction_project_id_idx on public.citizen_assignments (construction_project_id)
where
  construction_project_id is not null;

-- Index on deposit_instance_id (ON DELETE CASCADE). Used in cascade deletes during per-turn deposit depletion.
create index citizen_assignments_deposit_instance_id_idx on public.citizen_assignments (deposit_instance_id)
where
  deposit_instance_id is not null;

-- Index on managed_population_instance_id (ON DELETE CASCADE). Used in cascade deletes during per-turn population extinction.
create index citizen_assignments_managed_population_instance_id_idx on public.citizen_assignments (managed_population_instance_id)
where
  managed_population_instance_id is not null;

-- Index on trade_route_id (ON DELETE CASCADE). Used in cascade deletes and trade route updates.
create index citizen_assignments_trade_route_id_idx on public.citizen_assignments (trade_route_id)
where
  trade_route_id is not null;
