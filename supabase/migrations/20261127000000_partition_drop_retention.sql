-- Migration: partition_drop_retention (Task 1.6c)
--
-- Makes retention of the RANGE-subpartitioned settlement_turn_resource_snapshots
-- O(1) where possible: instead of row-by-row deleting whole elapsed turn windows,
-- DROP the sub-partitions that lie entirely below a world's snapshot cutoff
-- (metadata-only), then batched-DELETE only the boundary window's remaining old
-- rows.
--
-- Cutoff semantics (unchanged from Task 1.2): rows with turn_number < cutoff are
-- eligible for pruning; turn_number >= cutoff are kept. A RANGE sub-partition is
-- safe to DROP only when its exclusive upper bound <= cutoff (every row in it is
-- eligible). The boundary sub-partition (whose range contains the cutoff) holds
-- both eligible and kept rows and is NEVER dropped -- it is cleaned by the
-- existing batched DELETE.
--
-- Naming/bound scheme comes from ensure_str_snapshot_partitions
-- (20261125000000): per-world LIST partition str_snap_w_<world_hex>, RANGE
-- sub-partitions str_snap_w_<world_hex>_t<window_start> covering
-- [window_start, window_start + 100). We read each sub-partition's real bound via
-- pg_get_expr(relpartbound) rather than trusting the name, so this stays correct
-- for any window size.
--
-- Security decision: both functions are SECURITY DEFINER with search_path = ''
-- and are internal (not granted to authenticated/anon). The new helper only
-- enumerates children of the ONE target world's LIST partition (pg_inherits
-- inhparent = that partition), and each RANGE sub-partition has exactly one
-- parent, so a DROP can only affect the target world. It never touches the shared
-- DEFAULT partition (returns 0 when the world has no LIST partition).
-- ---------------------------------------------------------------------------
-- 1. internal_drop_elapsed_str_snapshot_partitions: drop a world's fully-elapsed
--    RANGE sub-partitions (upper bound <= cutoff), returning the number of rows
--    thereby removed (or, for a dry run, the number that WOULD be removed).
-- ---------------------------------------------------------------------------
create or replace function public.internal_drop_elapsed_str_snapshot_partitions (
  p_world_id uuid,
  p_cutoff_turn integer,
  p_dry_run boolean default false
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_part text := 'str_snap_w_' || replace(p_world_id::text, '-', '');
  v_world_oid regclass;
  v_child record;
  v_rows integer;
  v_total integer := 0;
begin
  if p_world_id is null then
    raise exception 'world_id required' using errcode = '22000';
  end if;

  -- No per-world LIST partition => any rows sit in the shared DEFAULT partition,
  -- which must never be dropped. Nothing to do; the caller's batched DELETE
  -- handles those rows.
  v_world_oid := to_regclass('public.' || v_world_part);
  if v_world_oid is null then
    return 0;
  end if;

  -- Enumerate ONLY this world's RANGE sub-partitions. Each such sub-partition has
  -- exactly one parent (this world's LIST partition), so dropping it can affect
  -- no other world. upper_bound is the exclusive RANGE upper bound parsed from
  -- the real partition bound, e.g. 'FOR VALUES FROM (100) TO (200)' => 200. A
  -- DEFAULT sub-partition (not created by ensure_str_snapshot_partitions, but
  -- guarded against anyway) yields NULL and is skipped.
  for v_child in
    select
      c.relname,
      (
        substring(
          pg_get_expr(c.relpartbound, c.oid)
          from 'TO \((-?[0-9]+)\)'
        )
      )::integer as upper_bound
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    where i.inhparent = v_world_oid
  loop
    if v_child.upper_bound is null then
      continue; -- DEFAULT or unparseable bound: never drop
    end if;

    -- Entirely elapsed: every row has turn_number < upper_bound <= cutoff.
    if v_child.upper_bound <= p_cutoff_turn then
      execute format ('select count(*) from public.%I', v_child.relname)
      into v_rows;
      v_total := v_total + coalesce(v_rows, 0);

      if not p_dry_run then
        execute format ('drop table public.%I', v_child.relname);
      end if;
    end if;
  end loop;

  return v_total;
end;
$$;

comment on function public.internal_drop_elapsed_str_snapshot_partitions (uuid, integer, boolean) is 'Internal retention helper: for one world, DROP every settlement_turn_resource_snapshots RANGE sub-partition whose exclusive upper bound <= p_cutoff_turn (entirely elapsed), returning the number of rows removed (or, for p_dry_run, that would be removed, dropping nothing). Never drops the boundary window (range contains the cutoff) nor the shared DEFAULT partition. Enumerates only the target world''s LIST-partition children, so a drop cannot affect another world. Not granted to authenticated.';

revoke all on function public.internal_drop_elapsed_str_snapshot_partitions (uuid, integer, boolean)
from
  public;

revoke
execute on function public.internal_drop_elapsed_str_snapshot_partitions (uuid, integer, boolean)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 2. internal_prune_world_retention (redefine): for
--    settlement_turn_resource_snapshots, FIRST drop the fully-elapsed turn
--    windows, THEN batched-delete the boundary window's remaining old rows. The
--    net settlement_turn_resource_snapshots_deleted = dropped-rows +
--    boundary-deleted-rows. Every other table, the dry-run counting, and the
--    return-jsonb keys are preserved byte-for-byte from 20261122000000.
-- ---------------------------------------------------------------------------
create or replace function public.internal_prune_world_retention (
  p_world_id uuid,
  p_dry_run boolean default false,
  p_batch_limit integer default 5000
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_current_turn integer;
  v_log_turns integer;
  v_snapshot_turns integer;
  v_memory_turns integer;
  v_snapshot_cutoff integer;
  v_log_cutoff integer;
  v_memory_cutoff integer;
  v_batch_trimmed integer;
  v_settlement_turn_snapshots_deleted integer := 0;
  v_settlement_turn_resource_snapshots_deleted integer := 0;
  v_nation_turn_snapshots_deleted integer := 0;
  v_nation_currency_snapshots_deleted integer := 0;
  v_army_turn_snapshots_deleted integer := 0;
  v_turn_log_entries_deleted integer := 0;
  v_nation_currency_ledger_deleted integer := 0;
  v_notifications_deleted integer := 0;
  v_citizen_memories_deleted integer := 0;
  v_event_memories_deleted integer := 0;
  v_turn_transitions_trimmed integer := 0;
begin
  if p_world_id is null then
    raise exception 'world_id required' using errcode = '22000';
  end if;

  if p_batch_limit < 1 then
    raise exception 'batch_limit must be >= 1' using errcode = '22000';
  end if;

  select w.current_turn_number
  into v_current_turn
  from public.worlds w
  where w.id = p_world_id;

  if v_current_turn is null then
    raise exception 'World not found' using errcode = 'P0002';
  end if;

  select r.log_turns, r.snapshot_turns, r.memory_turns
  into v_log_turns, v_snapshot_turns, v_memory_turns
  from public.internal_effective_retention (p_world_id) r;

  v_snapshot_cutoff := v_current_turn - v_snapshot_turns;
  v_log_cutoff := v_current_turn - v_log_turns;
  v_memory_cutoff := case
    when v_memory_turns is not null then v_current_turn - v_memory_turns
    else null
  end;

  -- Snapshot-governed tables + turn_transitions width-trim
  if v_snapshot_cutoff >= 1 then
    v_settlement_turn_snapshots_deleted := public.internal_prune_batch_delete (
      'public.settlement_turn_snapshots'::regclass,
      format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
      p_batch_limit,
      p_dry_run
    );

    -- settlement_turn_resource_snapshots is RANGE-subpartitioned per 100-turn
    -- window. On a real run, DROP the fully-elapsed windows (metadata-only), then
    -- batched-delete the boundary window's remaining eligible rows; the net count
    -- sums both. On a dry run nothing is dropped, so a single batched count of all
    -- turn_number < cutoff rows already equals what a real run would remove (the
    -- union of dropped-window rows and boundary rows) -- adding the helper's
    -- would-drop count here would double-count the elapsed windows.
    if p_dry_run then
      v_settlement_turn_resource_snapshots_deleted := public.internal_prune_batch_delete (
        'public.settlement_turn_resource_snapshots'::regclass,
        format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
        p_batch_limit,
        true
      );
    else
      v_settlement_turn_resource_snapshots_deleted :=
        public.internal_drop_elapsed_str_snapshot_partitions (
          p_world_id,
          v_snapshot_cutoff,
          false
        )
        + public.internal_prune_batch_delete (
          'public.settlement_turn_resource_snapshots'::regclass,
          format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
          p_batch_limit,
          false
        );
    end if;

    v_nation_turn_snapshots_deleted := public.internal_prune_batch_delete (
      'public.nation_turn_snapshots'::regclass,
      format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
      p_batch_limit,
      p_dry_run
    );

    v_nation_currency_snapshots_deleted := public.internal_prune_batch_delete (
      'public.nation_currency_snapshots'::regclass,
      format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
      p_batch_limit,
      p_dry_run
    );

    v_army_turn_snapshots_deleted := public.internal_prune_batch_delete (
      'public.army_turn_snapshots'::regclass,
      format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
      p_batch_limit,
      p_dry_run
    );

    -- Width-trim: null out the two large jsonb columns for transitions
    -- outside the snapshot window, keeping the row (status/to_turn_number)
    -- intact for history/audit purposes.
    if p_dry_run then
      execute format (
        'select count(*) from public.turn_transitions where world_id = %L and to_turn_number < %L and (readiness_summary_jsonb is not null or forecast_snapshot_jsonb is not null)',
        p_world_id,
        v_snapshot_cutoff
      ) into v_turn_transitions_trimmed;
    else
      loop
        execute format (
          'update public.turn_transitions set readiness_summary_jsonb = null, forecast_snapshot_jsonb = null where ctid in (select ctid from public.turn_transitions where world_id = %L and to_turn_number < %L and (readiness_summary_jsonb is not null or forecast_snapshot_jsonb is not null) limit %L)',
          p_world_id,
          v_snapshot_cutoff,
          p_batch_limit
        );
        get diagnostics v_batch_trimmed = row_count;
        v_turn_transitions_trimmed := v_turn_transitions_trimmed + v_batch_trimmed;
        exit when v_batch_trimmed = 0;
      end loop;
    end if;
  end if;

  -- Log-governed tables
  if v_log_cutoff >= 1 then
    v_turn_log_entries_deleted := public.internal_prune_batch_delete (
      'public.turn_log_entries'::regclass,
      format (
        'world_id = %L and turn_transition_id in (select id from public.turn_transitions where world_id = %L and to_turn_number < %L)',
        p_world_id,
        p_world_id,
        v_log_cutoff
      ),
      p_batch_limit,
      p_dry_run
    );

    v_nation_currency_ledger_deleted := public.internal_prune_batch_delete (
      'public.nation_currency_ledger'::regclass,
      format (
        'turn_number < %L and currency_id in (select id from public.nation_currencies where world_id = %L)',
        v_log_cutoff,
        p_world_id
      ),
      p_batch_limit,
      p_dry_run
    );

    v_notifications_deleted := public.internal_prune_batch_delete (
      'public.notifications'::regclass,
      format (
        'world_id = %L and generated_in_transition_id in (select id from public.turn_transitions where world_id = %L and to_turn_number < %L)',
        p_world_id,
        p_world_id,
        v_log_cutoff
      ),
      p_batch_limit,
      p_dry_run
    );
  end if;

  -- Memory-governed tables: skipped entirely when memory_turns IS NULL.
  if v_memory_cutoff is not null and v_memory_cutoff >= 1 then
    v_citizen_memories_deleted := public.internal_prune_batch_delete (
      'public.citizen_memories'::regclass,
      format ('world_id = %L and occurred_on_turn_number < %L', p_world_id, v_memory_cutoff),
      p_batch_limit,
      p_dry_run
    );

    -- event_memories: see the design-decision note above the section header.
    if not p_dry_run then
      perform set_config ('app.retention_pruning_event_memories', 'true', true);
    end if;

    v_event_memories_deleted := public.internal_prune_batch_delete (
      'public.event_memories'::regclass,
      format (
        'event_id in (select id from public.events where world_id = %L and status in (''expired'', ''cancelled'') and activate_on_transition_after_turn_number < %L)',
        p_world_id,
        v_memory_cutoff
      ),
      p_batch_limit,
      p_dry_run
    );

    if not p_dry_run then
      perform set_config ('app.retention_pruning_event_memories', 'false', true);
    end if;
  end if;

  return jsonb_build_object (
    'world_id', p_world_id,
    'current_turn', v_current_turn,
    'snapshot_cutoff_turn', v_snapshot_cutoff,
    'log_cutoff_turn', v_log_cutoff,
    'memory_cutoff_turn', v_memory_cutoff,
    'settlement_turn_snapshots_deleted', v_settlement_turn_snapshots_deleted,
    'settlement_turn_resource_snapshots_deleted', v_settlement_turn_resource_snapshots_deleted,
    'nation_turn_snapshots_deleted', v_nation_turn_snapshots_deleted,
    'nation_currency_snapshots_deleted', v_nation_currency_snapshots_deleted,
    'army_turn_snapshots_deleted', v_army_turn_snapshots_deleted,
    'turn_log_entries_deleted', v_turn_log_entries_deleted,
    'nation_currency_ledger_deleted', v_nation_currency_ledger_deleted,
    'notifications_deleted', v_notifications_deleted,
    'citizen_memories_deleted', v_citizen_memories_deleted,
    'event_memories_deleted', v_event_memories_deleted,
    'turn_transitions_trimmed', v_turn_transitions_trimmed,
    'dry_run', p_dry_run
  );
exception
  when others then
    raise exception 'Pruning failed: %', sqlerrm using errcode = sqlstate;
end;
$$;

comment on function public.internal_prune_world_retention (uuid, boolean, integer) is 'Internal, no-auth-gate retention prune covering every per-turn append table (snapshot-, log-, and memory-governed) plus the turn_transitions width-trim. Callable by the table owner / a future cron job -- not granted to authenticated. Resolves the world''s effective retention window via internal_effective_retention; memory tables are skipped entirely when memory_turns IS NULL. For settlement_turn_resource_snapshots it first DROPs fully-elapsed 100-turn window sub-partitions, then batched-deletes the boundary window''s remaining old rows.';

revoke all on function public.internal_prune_world_retention (uuid, boolean, integer)
from
  public;

revoke
execute on function public.internal_prune_world_retention (uuid, boolean, integer)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 3. prune_old_snapshots_and_logs (redefine): the superadmin manual RPC gains
--    the same partition-drop fast path for settlement_turn_resource_snapshots,
--    so the manual and automated prune paths stay consistent. The helper is a
--    safe no-op (returns 0) for a world with no per-world LIST partition (rows in
--    the shared DEFAULT partition), so the batched DELETE still covers those.
--    Body otherwise byte-for-byte from 20261122000000; return shape unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.prune_old_snapshots_and_logs (
  p_world_id uuid,
  p_retention_turns integer default 100,
  p_prune_notifications boolean default false,
  p_dry_run boolean default false
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
  v_batch_limit constant integer := 5000;
begin
  -- Validate input
  if p_world_id is null then
    raise exception 'world_id required' using errcode = '22000';
  end if;

  if p_retention_turns < 1 then
    raise exception 'retention_turns must be >= 1' using errcode = '22000';
  end if;

  -- Auth check: superadmin only
  if not public.is_super_admin () then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  -- Fetch world; lock to prevent concurrent turn advances during destructive run.
  -- Dry-run does not lock (read-only).
  if p_dry_run then
    select * into v_world_row
    from public.worlds w
    where w.id = p_world_id;
  else
    select * into v_world_row
    from public.worlds w
    where w.id = p_world_id
    for update;
  end if;

  if v_world_row.id is null then
    raise exception 'World not found' using errcode = 'P0002';
  end if;

  v_current_turn := v_world_row.current_turn_number;
  -- cutoff is exclusive: rows with turn_number < cutoff are eligible.
  -- turn_number = current_turn is always >= cutoff, so the latest transition
  -- and its snapshots/logs are always retained.
  v_cutoff_turn := v_current_turn - p_retention_turns;

  -- Early exit: not enough turns to prune anything
  if v_cutoff_turn < 1 then
    return jsonb_build_object (
      'snapshots_deleted', 0,
      'resource_snapshots_deleted', 0,
      'log_entries_deleted', 0,
      'notifications_deleted', 0,
      'current_turn', v_current_turn,
      'cutoff_turn', v_cutoff_turn,
      'dry_run', p_dry_run,
      'message', 'No pruning: world has < ' || p_retention_turns || ' turns'
    );
  end if;

  v_snapshots_deleted := public.internal_prune_batch_delete (
    'public.settlement_turn_snapshots'::regclass,
    format ('world_id = %L and turn_number < %L', p_world_id, v_cutoff_turn),
    v_batch_limit,
    p_dry_run
  );

  -- settlement_turn_resource_snapshots: on a real run, DROP fully-elapsed window
  -- sub-partitions first, then batched-delete the boundary window's remaining old
  -- rows (net = dropped-rows + boundary-deleted-rows). On a dry run nothing is
  -- dropped, so a single batched count of all turn_number < cutoff rows already
  -- equals what a real run would remove -- adding the helper's would-drop count
  -- would double-count the elapsed windows.
  if p_dry_run then
    v_resource_snapshots_deleted := public.internal_prune_batch_delete (
      'public.settlement_turn_resource_snapshots'::regclass,
      format ('world_id = %L and turn_number < %L', p_world_id, v_cutoff_turn),
      v_batch_limit,
      true
    );
  else
    v_resource_snapshots_deleted :=
      public.internal_drop_elapsed_str_snapshot_partitions (
        p_world_id,
        v_cutoff_turn,
        false
      )
      + public.internal_prune_batch_delete (
        'public.settlement_turn_resource_snapshots'::regclass,
        format ('world_id = %L and turn_number < %L', p_world_id, v_cutoff_turn),
        v_batch_limit,
        false
      );
  end if;

  v_log_entries_deleted := public.internal_prune_batch_delete (
    'public.turn_log_entries'::regclass,
    format (
      'world_id = %L and turn_transition_id in (select id from public.turn_transitions where world_id = %L and to_turn_number < %L)',
      p_world_id,
      p_world_id,
      v_cutoff_turn
    ),
    v_batch_limit,
    p_dry_run
  );

  if p_prune_notifications then
    v_notifications_deleted := public.internal_prune_batch_delete (
      'public.notifications'::regclass,
      format (
        'world_id = %L and generated_in_transition_id in (select id from public.turn_transitions where world_id = %L and to_turn_number < %L)',
        p_world_id,
        p_world_id,
        v_cutoff_turn
      ),
      v_batch_limit,
      p_dry_run
    );
  end if;

  return jsonb_build_object (
    'snapshots_deleted', v_snapshots_deleted,
    'resource_snapshots_deleted', v_resource_snapshots_deleted,
    'log_entries_deleted', v_log_entries_deleted,
    'notifications_deleted', v_notifications_deleted,
    'current_turn', v_current_turn,
    'cutoff_turn', v_cutoff_turn,
    'retention_turns', p_retention_turns,
    'dry_run', p_dry_run,
    'message', case when p_dry_run then 'Dry-run complete' else 'Pruning complete' end
  );
exception
  when others then
    raise exception 'Pruning failed: %', sqlerrm using errcode = sqlstate;
end;
$$;
