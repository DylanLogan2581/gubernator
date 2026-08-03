-- Migration: auto_fail_stale_turn_transitions
-- Issue #1404. Auto-fail turn transitions abandoned by a dead worker.
--
-- With the running-turn write guard in place (20261223000000), a transition
-- stuck in 'running' freezes an entire world. turn_jobs' heartbeat covers a
-- worker dying while another is available to re-claim; this covers no worker
-- being alive at all. A failed transition surfaces to players as "paused, an
-- administrator has been notified" and is recoverable through the existing
-- fail_stuck_turn_transition path, which an indefinite freeze is not.
-- ---------------------------------------------------------------------------
create or replace function public.auto_fail_stale_turn_transitions (
  p_stale_after interval default interval '10 minutes'
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_failed integer;
begin
  -- The guard's escape hatch: turn_transitions itself is unguarded, but the
  -- fail path may touch guarded rows in future.
  perform set_config ('app.applying_turn', 'on', true);

  -- skip locked: a concurrent run steps over rows this one has locked rather
  -- than blocking on them, so overlapping schedules never contend.
  with
    stale as (
      select
        tt.id
      from
        public.turn_transitions tt
        join public.turn_jobs tj on tj.turn_transition_id = tt.id
      where
        tt.status = 'running'
        and coalesce(tj.heartbeat_at, tj.claimed_at, tt.started_at) < now() - p_stale_after
      for update
        of tt skip locked
    )
  update public.turn_transitions tt
  set
    status = 'failed',
    finished_at = now(),
    progress_stage = null
  from
    stale
  where
    tt.id = stale.id;

  get diagnostics v_failed = row_count;

  return v_failed;
end;
$$;

comment on function public.auto_fail_stale_turn_transitions (interval) is 'Marks running turn transitions failed when their turn job heartbeat has gone stale, so a dead worker cannot freeze a world indefinitely behind the running-turn write guard. Scheduled every five minutes via pg_cron. Not granted to anon/authenticated.';

revoke all on function public.auto_fail_stale_turn_transitions (interval)
from
  public,
  anon,
  authenticated;

-- Schedule every five minutes. Wrapped so the migration still applies on an
-- instance where pg_cron is not loaded (hosted Supabase requires enabling it
-- once in the dashboard Extensions list).
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule (
      'auto-fail-stale-turn-transitions',
      '*/5 * * * *',
      $cron$select public.auto_fail_stale_turn_transitions()$cron$
    );
  else
    raise notice 'auto_fail_stale_turn_transitions: pg_cron not installed; schedule not created.';
  end if;
exception
  when others then
    raise notice 'auto_fail_stale_turn_transitions: could not schedule cron job (%); skipping.', sqlerrm;
end;
$$;
