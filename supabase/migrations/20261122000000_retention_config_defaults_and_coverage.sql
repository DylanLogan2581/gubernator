-- Migration: retention_config_defaults_and_coverage
-- ---------------------------------------------------------------------------
-- Phase 1 of the retention roadmap makes per-world data retention automatic
-- and complete. This migration is appended to across tasks 1.1, 1.2 and 1.5;
-- keep each task's contents in its own clearly delimited section.
-- ===========================================================================
-- Task 1.1 — config defaults + effective-retention helper
-- ---------------------------------------------------------------------------
-- Adds:
--   1. world_retention_config.memory_retention_turns column (nullable, >= 1).
--   2. internal_effective_retention(world) helper resolving per-world retention
--      settings to concrete values, falling back to defaults when the config
--      row is absent or a column is NULL.
--
-- Defaults (no config row, or NULL column):
--   snapshot_turns = 200, log_turns = 200, memory_turns = NULL (keep-all).
--   memory_turns IS NULL means "never prune memories".
--
-- The helper is security definer / search_path='' so it can read the
-- superadmin-RLS world_retention_config table on behalf of internal callers
-- (tasks 1.2 and 1.5). It is INTERNAL: no grant to authenticated.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- 1. memory_retention_turns column
-- ---------------------------------------------------------------------------
alter table public.world_retention_config
add column memory_retention_turns integer;

alter table public.world_retention_config
add constraint world_retention_config_memory_turns_check check (
  memory_retention_turns is null
  or memory_retention_turns >= 1
);

comment on column public.world_retention_config.memory_retention_turns is 'Number of completed turns whose event memories to retain. Older turns are eligible for pruning. null = keep all (never prune memories).';

-- ---------------------------------------------------------------------------
-- 2. internal_effective_retention helper
-- ---------------------------------------------------------------------------
-- Returns the effective retention values for a world, coalescing missing config
-- (no row, or NULL columns) to defaults: log=200, snapshot=200, memory=NULL.
-- A LEFT JOIN from worlds guarantees a single row even when no config exists.
create or replace function public.internal_effective_retention (p_world_id uuid) returns table (
  log_turns integer,
  snapshot_turns integer,
  memory_turns integer
) language sql stable security definer
set
  search_path = '' as $$
  select
    coalesce(c.log_retention_turns, 200) as log_turns,
    coalesce(c.snapshot_retention_turns, 200) as snapshot_turns,
    c.memory_retention_turns as memory_turns
  from public.worlds w
  left join public.world_retention_config c on c.world_id = w.id
  where w.id = p_world_id;
$$;

comment on function public.internal_effective_retention (uuid) is 'Internal helper: resolves a world''s effective retention window to concrete values, coalescing a missing config row or NULL columns to defaults (log=200, snapshot=200, memory=NULL=keep-all). security definer to read superadmin-RLS world_retention_config. Not granted to authenticated.';

revoke all on function public.internal_effective_retention (uuid)
from
  public;

revoke
execute on function public.internal_effective_retention (uuid)
from
  anon,
  authenticated;

-- ===========================================================================
-- Task 1.2 — complete prune coverage across all per-turn append tables
-- ---------------------------------------------------------------------------
-- The pre-existing prune_old_snapshots_and_logs only ever covered 4 tables
-- (settlement_turn_snapshots, settlement_turn_resource_snapshots,
-- turn_log_entries, notifications) out of ~12 that grow every turn. This
-- section adds:
--
--   1. internal_prune_batch_delete: a shared, generic batched-delete helper.
--      Deletes rows matching a caller-built predicate from a table in
--      p_batch_limit-sized loops (via ctid), so a single retention run never
--      holds one giant delete's lock/plan for the whole eligible range.
--      p_dry_run counts instead of deleting. INTERNAL — the predicate text is
--      always built by trusted callers from typed values (uuid/integer via
--      %L), never from raw user input.
--   2. internal_freeze_event_memory_after_activation (redefined): adds a
--      transaction-local bypass so internal_prune_world_retention can delete
--      event_memories rows for long-terminated events. Established pattern —
--      see hard_delete_world's app.hard_delete_world flag
--      (20260801000000_skip_referential_integrity_on_hard_delete_world.sql).
--      Every admin-facing insert/update/delete path stays frozen unchanged.
--   3. internal_prune_world_retention: NO auth gate (internal, callable by
--      the table owner / a future cron job — see Task 1.1's helper). Resolves
--      a world's effective retention window via internal_effective_retention
--      and prunes every snapshot-, log-, and memory-governed append table,
--      plus width-trims turn_transitions. Memory tables are skipped entirely
--      when memory_turns IS NULL (keep-all).
--   4. prune_old_snapshots_and_logs (rewritten): keeps its superadmin gate and
--      its exact existing return keys (the frontend panel and
--      prune_old_snapshots_and_logs_test.sql depend on both), but now
--      delegates its deletes to internal_prune_batch_delete so this function
--      and internal_prune_world_retention can no longer drift apart on the
--      4 tables they both cover.
--
-- DESIGN DECISIONS / ASSUMPTIONS (surfaced for review)
-- -----------------------------------------------------
-- * nation_currency_ledger has no world_id column, but nation_currencies (its
--   parent via currency_id) already carries world_id directly -- no need to
--   go currency -> nation -> world_id through the nations table.
-- * notifications are pruned by transition (generated_in_transition_id in the
--   set of turn_transitions older than the log cutoff), not by generated_at
--   wall-clock time. Manual notifications (generated_in_transition_id IS
--   NULL) are never matched by that subquery and are always retained. This
--   also replaces prune_old_snapshots_and_logs's previous wall-clock
--   approximation for its own p_prune_notifications path; the existing test
--   never exercises that flag as true, so behavior there is unaffected.
-- * event_memories has neither world_id nor an absolute turn-number column
--   (only event_id + a relative turn_offset, consumed once per lifecycle
--   stage while its event is 'active'). It is scoped through its parent
--   event's world_id, and its "occurred" marker is taken as the parent
--   event's activate_on_transition_after_turn_number. Only events in a
--   terminal status (expired/cancelled) are eligible: 'pending' events have
--   no meaningful occurred turn yet, and 'active' events still read their own
--   event_memories rows turn-by-turn (internal_apply_turn_transition_event_
--   patches), so pruning them mid-flight would break that lookup.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- 1. internal_prune_batch_delete: shared batched delete/count helper
-- ---------------------------------------------------------------------------
create or replace function public.internal_prune_batch_delete (
  p_table regclass,
  p_predicate text,
  p_batch_limit integer,
  p_dry_run boolean
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_total integer := 0;
  v_deleted integer;
begin
  if p_dry_run then
    execute format ('select count(*) from %s where %s', p_table, p_predicate) into v_total;
    return v_total;
  end if;

  loop
    execute format (
      'delete from %s where ctid in (select ctid from %s where %s limit %s)',
      p_table,
      p_table,
      p_predicate,
      p_batch_limit
    );
    get diagnostics v_deleted = row_count;
    v_total := v_total + v_deleted;
    exit when v_deleted = 0;
  end loop;

  return v_total;
end;
$$;

comment on function public.internal_prune_batch_delete (regclass, text, integer, boolean) is 'Internal shared batched-delete helper for retention pruning. Deletes rows matching p_predicate from p_table in p_batch_limit-sized loops via ctid, accumulating the total deleted (or counts them, unchanged, when p_dry_run). Predicate text must only ever be built by trusted internal callers from typed values -- never from raw user input. Not granted to authenticated.';

revoke all on function public.internal_prune_batch_delete (regclass, text, integer, boolean)
from
  public;

revoke
execute on function public.internal_prune_batch_delete (regclass, text, integer, boolean)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 2. internal_freeze_event_memory_after_activation (redefine): add a
--    transaction-local bypass for retention pruning, mirroring the
--    app.hard_delete_world pattern. Body otherwise unchanged from
--    20260824000000_event_memories_per_turn.sql (the latest prior definition).
-- ---------------------------------------------------------------------------
create or replace function public.internal_freeze_event_memory_after_activation () returns trigger language plpgsql
set
  search_path = '' as $$
declare
  v_event_status text;
begin
  -- Skip during retention pruning: internal_prune_world_retention deletes
  -- event_memories rows for long-terminated events and sets this
  -- transaction-local flag first. Every admin-facing insert/update/delete
  -- path stays frozen unchanged.
  if tg_op = 'DELETE' and current_setting ('app.retention_pruning_event_memories', true) = 'true' then
    return old;
  end if;

  select status
  into v_event_status
  from public.events
  where id = coalesce(new.event_id, old.event_id);

  if v_event_status is distinct from 'pending' then
    raise exception 'Cannot change citizen-memory settings once an event has activated'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. internal_prune_world_retention: full-coverage retention prune
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

    v_settlement_turn_resource_snapshots_deleted := public.internal_prune_batch_delete (
      'public.settlement_turn_resource_snapshots'::regclass,
      format ('world_id = %L and turn_number < %L', p_world_id, v_snapshot_cutoff),
      p_batch_limit,
      p_dry_run
    );

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

comment on function public.internal_prune_world_retention (uuid, boolean, integer) is 'Internal, no-auth-gate retention prune covering every per-turn append table (snapshot-, log-, and memory-governed) plus the turn_transitions width-trim. Callable by the table owner / a future cron job -- not granted to authenticated. Resolves the world''s effective retention window via internal_effective_retention; memory tables are skipped entirely when memory_turns IS NULL.';

revoke all on function public.internal_prune_world_retention (uuid, boolean, integer)
from
  public;

revoke
execute on function public.internal_prune_world_retention (uuid, boolean, integer)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 4. prune_old_snapshots_and_logs (rewrite): keep the superadmin gate and
--    exact return shape; delegate deletes to internal_prune_batch_delete so
--    this and internal_prune_world_retention share one deletion path.
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

  v_resource_snapshots_deleted := public.internal_prune_batch_delete (
    'public.settlement_turn_resource_snapshots'::regclass,
    format ('world_id = %L and turn_number < %L', p_world_id, v_cutoff_turn),
    v_batch_limit,
    p_dry_run
  );

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
