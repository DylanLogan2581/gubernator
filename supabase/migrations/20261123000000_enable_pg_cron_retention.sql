-- Migration: enable_pg_cron_retention
-- ---------------------------------------------------------------------------
-- Task 1.3 of the Phase 1 retention roadmap. Tasks 1.1/1.2 built
-- internal_prune_world_retention(world_id, dry_run, batch_limit) -- an
-- internal (no-auth-gate, security definer) function that prunes ALL
-- per-turn append tables for one world using that world's retention config.
-- This migration automates it: every world is pruned nightly via pg_cron, so
-- retention needs no human action.
--
-- Adds:
--   1. public.run_scheduled_retention(): loops every world and calls
--      internal_prune_world_retention for each, isolating failures per-world
--      so one bad world cannot abort the whole nightly batch.
--   2. pg_cron extension + a 'nightly-retention' cron.job scheduled at
--      03:17 daily (17-minute offset from midnight is intentional, to avoid
--      piling onto other jobs that fire exactly on the hour).
--
-- Local-test-image robustness (critical): pg_cron requires
-- shared_preload_libraries and may not be loadable in every environment that
-- runs this migration (some CI/local images don't preload it). Both the
-- `create extension` and the `cron.schedule` call are wrapped in guarded do
-- blocks that catch any exception and raise a notice instead, so the
-- migration always applies cleanly whether or not pg_cron is available.
--
-- Hosted Supabase note: on hosted projects, pg_cron typically still needs to
-- be enabled once via the dashboard's Database > Extensions list (or this
-- extension create can fail silently there too, per the guard above) before
-- the schedule below will actually run.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- 1. run_scheduled_retention: prune every world, isolating per-world failures
-- ---------------------------------------------------------------------------
create or replace function public.run_scheduled_retention () returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world record;
begin
  for v_world in select id from public.worlds loop
    begin
      perform public.internal_prune_world_retention (v_world.id);
    exception
      when others then
        raise warning 'run_scheduled_retention: pruning world % failed: %', v_world.id, sqlerrm;
    end;
  end loop;
end;
$$;

comment on function public.run_scheduled_retention () is 'Internal: nightly-scheduled retention sweep. Loops every world and prunes it via internal_prune_world_retention, isolating each world in its own begin/exception block so one failing world cannot abort the batch. Invoked by the nightly-retention pg_cron job. Not granted to authenticated.';

revoke all on function public.run_scheduled_retention ()
from
  public;

revoke
execute on function public.run_scheduled_retention ()
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 2. Enable pg_cron (guarded) and schedule the nightly sweep (guarded)
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'run_scheduled_retention: pg_cron extension could not be enabled (%); skipping nightly-retention schedule. On hosted Supabase, enable pg_cron once via the dashboard Extensions list.', sqlerrm;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule ('nightly-retention', '17 3 * * *', $cron$select public.run_scheduled_retention()$cron$);
  else
    raise notice 'run_scheduled_retention: pg_cron not installed; nightly-retention schedule not created.';
  end if;
exception
  when others then
    raise notice 'run_scheduled_retention: could not schedule nightly-retention cron job (%); skipping.', sqlerrm;
end;
$$;
