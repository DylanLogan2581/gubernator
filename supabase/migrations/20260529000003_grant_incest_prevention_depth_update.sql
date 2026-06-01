-- Migration: grant_incest_prevention_depth_update
-- Grants the authenticated role column-level UPDATE access to
-- incest_prevention_depth so the population-rules editor can save it.
-- The column was added in 20260524000000 but the column-level grant was
-- omitted from that migration and from the population-rules migration.
-- ---------------------------------------------------------------------------
grant
update (incest_prevention_depth) on public.worlds to authenticated;
