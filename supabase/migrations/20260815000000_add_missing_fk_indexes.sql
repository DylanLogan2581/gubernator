-- Migration: add_missing_fk_indexes
-- Adds indexes on FK columns that were missed when their tables were created.
-- Without these, deletes/lookups on the referenced tables seq-scan the
-- referencing table as worlds grow. Confirmed absent from
-- 20260804000000_add_perf_indexes.sql.
-- ---------------------------------------------------------------------------
-- trade_route_legs.resource_id (on delete restrict) — only trade_route_id
-- was indexed; not-null column, so a plain (non-partial) index.
create index if not exists trade_route_legs_resource_id_idx on public.trade_route_legs (resource_id);

-- event_effects.managed_population_instance_id and .deposit_instance_id
-- (both on delete set null, nullable) — resource_id and job_id already got
-- partial indexes in 20260702000000_add_event_effects_table.sql, these did
-- not.
create index if not exists event_effects_managed_population_instance_id_idx on public.event_effects (managed_population_instance_id)
where
  managed_population_instance_id is not null;

create index if not exists event_effects_deposit_instance_id_idx on public.event_effects (deposit_instance_id)
where
  deposit_instance_id is not null;
