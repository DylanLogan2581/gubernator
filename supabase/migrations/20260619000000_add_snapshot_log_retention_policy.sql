-- Migration: add_snapshot_log_retention_policy
-- Adds time-based retention policy for settlement_turn_snapshots,
-- settlement_turn_resource_snapshots, and turn_log_entries.
--
-- DESIGN DECISION: TIME-BASED RETENTION WITH RPC PRUNING
-- =========================================================
-- Problem: settlement snapshots/logs grow unbounded (1200 rows/turn × 365 days/year
-- = ~438k rows/year per world). Indexes and cascade-delete fan-out bloat storage
-- and degrade per-turn insert cost over time.
--
-- Solution: Prune old snapshot/log rows beyond a configurable retention window.
-- Default: keep last 100 turns (~3 months for 1 turn/day worlds).
-- Method: RPC function called by admins or future pg_cron scheduler (not yet integrated).
--
-- Rationale vs. alternatives:
--   - Partitioning: more complex schema, requires manual partition management
--   - Archive: added code complexity, separate archive queries
--   - RPC: simple, flexible retention window, works with future pg_cron, no schema overhead
--
-- Per-turn insert cost: RPC pruning only touches indexed columns (world_id, turn_number),
-- so deletes use efficient index scans; insert cost not affected by historical row count.
-- ---------------------------------------------------------------------------
-- Indexes for efficient pruning
-- ---------------------------------------------------------------------------
create index if not exists settlement_turn_snapshots_world_turn_idx on public.settlement_turn_snapshots (world_id, turn_number desc);

create index if not exists settlement_turn_resource_snapshots_world_turn_idx on public.settlement_turn_resource_snapshots (world_id, turn_number desc);

create index if not exists turn_transitions_world_turn_idx on public.turn_transitions (world_id, to_turn_number desc);

-- ---------------------------------------------------------------------------
-- RPC: prune_old_snapshots_and_logs
-- ---------------------------------------------------------------------------
-- Prunes settlement snapshots, resource snapshots, and turn logs older than
-- (current_world_turn - retention_turns).
--
-- Parameters:
--   p_world_id: world to prune
--   p_retention_turns: keep this many turns; default 100
--
-- Returns: row count with {snapshots_deleted, resource_snapshots_deleted, log_entries_deleted}
--
-- Behavior:
--   - Requires world_admin or super_admin privilege
--   - Calculates current_turn from worlds.current_turn_number
--   - Deletes by turn_number < threshold to avoid off-by-one errors
--   - Logs are pruned indirectly via cascade delete on turn_transitions
--     (turning log entries whose turn_transition_id is deleted)
--   - Notifications pruned separately if p_prune_notifications = true
--   - Idempotent: safe to call multiple times
-- ---------------------------------------------------------------------------
create or replace function public.prune_old_snapshots_and_logs (
  p_world_id uuid,
  p_retention_turns integer default 100,
  p_prune_notifications boolean default false
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_row public.worlds%rowtype;
  v_current_turn integer;
  v_cutoff_turn integer;
  v_snapshots_deleted integer := 0;
  v_resource_snapshots_deleted integer := 0;
  v_log_entries_deleted integer := 0;
  v_notifications_deleted integer := 0;
begin
  -- Validate input
  if p_world_id is null then
    raise exception 'world_id required' using errcode = '22000';
  end if;

  if p_retention_turns < 1 then
    raise exception 'retention_turns must be >= 1' using errcode = '22000';
  end if;

  -- Fetch world; lock for update to prevent concurrent turn advances
  select *
  into v_world_row
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world_row.id is null then
    raise exception 'World not found' using errcode = 'P0002';
  end if;

  -- Auth check: world_admin or super_admin
  if not (public.is_world_admin (p_world_id) or public.is_super_admin ()) then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  v_current_turn := v_world_row.current_turn_number;
  v_cutoff_turn := v_current_turn - p_retention_turns;

  -- Early exit if cutoff is negative (not enough turns to prune)
  if v_cutoff_turn < 1 then
    return jsonb_build_object (
      'snapshots_deleted', 0,
      'resource_snapshots_deleted', 0,
      'log_entries_deleted', 0,
      'notifications_deleted', 0,
      'current_turn', v_current_turn,
      'cutoff_turn', v_cutoff_turn,
      'message', 'No pruning: world has < ' || p_retention_turns || ' turns'
    );
  end if;

  -- Prune settlement_turn_snapshots
  delete from public.settlement_turn_snapshots
  where world_id = p_world_id
    and turn_number < v_cutoff_turn;
  get diagnostics v_snapshots_deleted = row_count;

  -- Prune settlement_turn_resource_snapshots
  delete from public.settlement_turn_resource_snapshots
  where world_id = p_world_id
    and turn_number < v_cutoff_turn;
  get diagnostics v_resource_snapshots_deleted = row_count;

  -- Prune turn_log_entries by looking up turn_transitions and deleting associated logs
  -- Don't delete turn_transitions itself; preserve metadata for historical lookup
  delete from public.turn_log_entries
  where world_id = p_world_id
    and turn_transition_id in (
      select id from public.turn_transitions
      where world_id = p_world_id
        and to_turn_number < v_cutoff_turn
    );
  get diagnostics v_log_entries_deleted = row_count;

  -- Optionally prune notifications (rare use case; default false)
  if p_prune_notifications then
    delete from public.notifications
    where world_id = p_world_id
      and created_at < (now () - (v_current_turn - v_cutoff_turn) * interval '1 day');
    get diagnostics v_notifications_deleted = row_count;
  end if;

  return jsonb_build_object (
    'snapshots_deleted', v_snapshots_deleted,
    'resource_snapshots_deleted', v_resource_snapshots_deleted,
    'log_entries_deleted', v_log_entries_deleted,
    'notifications_deleted', v_notifications_deleted,
    'current_turn', v_current_turn,
    'cutoff_turn', v_cutoff_turn,
    'retention_turns', p_retention_turns,
    'message', 'Pruning complete'
  );
exception
  when others then
    raise exception 'Pruning failed: %', sqlerrm using errcode = sqlstate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke all on function public.prune_old_snapshots_and_logs (uuid, integer, boolean)
from
  public;

grant
execute on function public.prune_old_snapshots_and_logs (uuid, integer, boolean) to authenticated;
