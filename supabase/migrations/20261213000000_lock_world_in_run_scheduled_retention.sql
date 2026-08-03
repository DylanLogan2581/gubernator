-- Migration: lock_world_in_run_scheduled_retention
-- ---------------------------------------------------------------------------
-- Follow-up to the Phase 1 retention automation
-- (20261123000000_enable_pg_cron_retention.sql). The nightly sweep pruned each
-- world without locking the world row, unlike the manual
-- prune_old_snapshots_and_logs path, which takes `for update` to keep a prune
-- from interleaving with a turn advance. The drop-retention path added in
-- 20261127000000 detaches/drops elapsed sub-partitions, which takes an
-- ACCESS EXCLUSIVE lock and could in principle contend with a turn advancing
-- the same world.
--
-- This takes the same per-world `for update` lock the manual path takes, one
-- world at a time, inside the existing per-world begin/exception block: a lock
-- wait or failure on one world still cannot abort the batch.
-- ===========================================================================
create or replace function public.run_scheduled_retention () returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world record;
begin
  for v_world in select id from public.worlds loop
    begin
      -- Lock the world row for the duration of this world's prune, mirroring
      -- public.prune_old_snapshots_and_logs, so retention cannot interleave
      -- with a turn advance for the same world.
      perform 1 from public.worlds w where w.id = v_world.id for update;

      perform public.internal_prune_world_retention (v_world.id);
    exception
      when others then
        raise warning 'run_scheduled_retention: pruning world % failed: %', v_world.id, sqlerrm;
    end;
  end loop;
end;
$$;

comment on function public.run_scheduled_retention () is 'Internal: nightly-scheduled retention sweep. Loops every world, locks each world row for update (matching the manual prune path) and prunes it via internal_prune_world_retention, isolating each world in its own begin/exception block so one failing world cannot abort the batch. Invoked by the nightly-retention pg_cron job. Not granted to authenticated.';

revoke all on function public.run_scheduled_retention ()
from
  public;

revoke
execute on function public.run_scheduled_retention ()
from
  anon,
  authenticated;
