-- Migration: drop_managed_population_cull_le_count
-- Drops the planning-time CHECK constraint managed_population_instances_cull_le_count
-- (configured_cull_quantity <= current_count).
--
-- The Epic 6 simulation culling/decline phase transiently reduces current_count
-- below configured_cull_quantity before clamping the value. Postgres CHECK
-- constraints cannot be deferred, so the constraint must be removed.
--
-- The planning-time invariant is preserved by:
--   - set_configured_cull_quantity RPC (server-side guard for direct UI writes)
--   - setConfiguredCullQuantityInputSchema (client-side validation)
alter table public.managed_population_instances
drop constraint managed_population_instances_cull_le_count;
