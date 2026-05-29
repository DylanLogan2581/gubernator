-- Migration: add_world_incest_prevention_depth
-- Adds the per-world incest-prevention depth used by the citizen creation
-- mutations to reject parent pairings whose nearest common ancestor sits
-- within the given number of generations. A depth of 0 disables the check, 1
-- blocks siblings, 2 blocks first cousins, 3 blocks second cousins, and so on.
-- The upper bound is intentionally narrow so the recursive ancestor walk
-- inside citizens_have_close_kinship terminates in bounded work even on dense
-- family graphs.
-- ---------------------------------------------------------------------------
alter table public.worlds
add column incest_prevention_depth integer not null default 4;

alter table public.worlds
add constraint worlds_incest_prevention_depth_check check (incest_prevention_depth between 0 and 10);

comment on column public.worlds.incest_prevention_depth is 'Number of generations checked when validating parent pairings during citizen creation. 0 disables the check; higher values reject more-distant kin.';
