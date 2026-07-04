-- Migration: add_retention_config_and_dry_run_prune
-- ---------------------------------------------------------------------------
-- 1. world_retention_config: per-world retention settings (null = keep-all)
-- 2. prune_old_snapshots_and_logs: adds dry-run mode, restricts to superadmin,
--    explicitly guards the latest completed transition so its data always survives.
--
-- DESIGN DECISIONS
-- ----------------
-- Superadmin-only: Pruning is destructive and irreversible. World admins can
-- already inspect data; only superadmins can purge it.
--
-- Dry-run: Uses SELECT count(*) with the same WHERE predicate as the live DELETE,
-- so counts are deterministic and match what a subsequent destructive call removes
-- (assuming no concurrent turn advance between calls).
--
-- Snapshot retention: Old snapshots are pruned (not downsampled/archived).
-- Report views query settlement_turn_snapshots/settlement_turn_resource_snapshots
-- by turn_number — any turn in the retained window renders correctly. Turns outside
-- the window are unavailable after pruning, which is intentional.
--
-- Latest transition protection: The prune cutoff is strictly less than the
-- current_turn_number, so turn_number = current_turn is always retained. The
-- most recent completed turn_transition and all its snapshots/logs survive.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- world_retention_config
-- ---------------------------------------------------------------------------
create table public.world_retention_config (
  world_id uuid primary key references public.worlds (id) on delete cascade,
  log_retention_turns integer,
  snapshot_retention_turns integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_retention_config_log_turns_check check (
    log_retention_turns is null
    or log_retention_turns >= 1
  ),
  constraint world_retention_config_snapshot_turns_check check (
    snapshot_retention_turns is null
    or snapshot_retention_turns >= 1
  )
);

comment on table public.world_retention_config is 'Per-world retention settings. log_retention_turns/snapshot_retention_turns = null means keep-all (no pruning). A row is only inserted when an admin explicitly configures a world.';

comment on column public.world_retention_config.log_retention_turns is 'Number of completed turns whose log entries to retain. Older turns are eligible for pruning. null = keep all.';

comment on column public.world_retention_config.snapshot_retention_turns is 'Number of completed turns whose snapshots to retain. Older turns are eligible for pruning. null = keep all.';

alter table public.world_retention_config enable row level security;

-- Superadmin-only: only superadmins may read or write retention config.
create policy "world_retention_config_select_superadmin" on public.world_retention_config for
select
  to authenticated using (public.is_super_admin ());

create policy "world_retention_config_insert_superadmin" on public.world_retention_config for insert to authenticated
with
  check (public.is_super_admin ());

create policy "world_retention_config_update_superadmin" on public.world_retention_config
for update
  to authenticated using (public.is_super_admin ())
with
  check (public.is_super_admin ());

create policy "world_retention_config_delete_superadmin" on public.world_retention_config for delete to authenticated using (public.is_super_admin ());

grant
select
,
  insert,
update,
delete on public.world_retention_config to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_world_retention_config RPC
-- ---------------------------------------------------------------------------
create or replace function public.upsert_world_retention_config (
  p_world_id uuid,
  p_log_retention_turns integer default null,
  p_snapshot_retention_turns integer default null
) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'Insufficient privilege' using errcode = '42501';
  end if;

  insert into public.world_retention_config (
    world_id,
    log_retention_turns,
    snapshot_retention_turns,
    updated_at
  )
  values (
    p_world_id,
    p_log_retention_turns,
    p_snapshot_retention_turns,
    now ()
  )
  on conflict (world_id) do update
    set
      log_retention_turns = excluded.log_retention_turns,
      snapshot_retention_turns = excluded.snapshot_retention_turns,
      updated_at = now ();
end;
$$;

revoke all on function public.upsert_world_retention_config (uuid, integer, integer)
from
  public;

grant
execute on function public.upsert_world_retention_config (uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the old 3-param signature before replacing with the new 4-param version.
-- Both variants would otherwise coexist as PostgreSQL overloads, causing "not
-- unique" errors on calls that rely on default arguments.
-- ---------------------------------------------------------------------------
drop function if exists public.prune_old_snapshots_and_logs (uuid, integer, boolean);

-- ---------------------------------------------------------------------------
-- prune_old_snapshots_and_logs (replace — adds p_dry_run, superadmin-only,
-- explicit latest-turn guard)
-- ---------------------------------------------------------------------------
-- Parameters:
--   p_world_id              world to prune
--   p_retention_turns       keep snapshots/logs for this many turns (default 100)
--   p_prune_notifications   also prune notifications (default false)
--   p_dry_run               when true, return counts without deleting (default false)
--
-- Latest-transition guarantee: cutoff = current_turn - retention_turns.
-- Rows with turn_number >= current_turn are never touched. Since the latest
-- completed turn always equals current_turn, its snapshots and logs survive.
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

  if p_dry_run then
    -- Count rows that would be deleted; no mutations
    select count(*) into v_snapshots_deleted
    from public.settlement_turn_snapshots
    where world_id = p_world_id
      and turn_number < v_cutoff_turn;

    select count(*) into v_resource_snapshots_deleted
    from public.settlement_turn_resource_snapshots
    where world_id = p_world_id
      and turn_number < v_cutoff_turn;

    select count(*) into v_log_entries_deleted
    from public.turn_log_entries
    where world_id = p_world_id
      and turn_transition_id in (
        select id from public.turn_transitions
        where world_id = p_world_id
          and to_turn_number < v_cutoff_turn
      );

    if p_prune_notifications then
      select count(*) into v_notifications_deleted
      from public.notifications
      where world_id = p_world_id
        and created_at < (now () - (v_current_turn - v_cutoff_turn) * interval '1 day');
    end if;
  else
    -- Destructive path
    delete from public.settlement_turn_snapshots
    where world_id = p_world_id
      and turn_number < v_cutoff_turn;
    get diagnostics v_snapshots_deleted = row_count;

    delete from public.settlement_turn_resource_snapshots
    where world_id = p_world_id
      and turn_number < v_cutoff_turn;
    get diagnostics v_resource_snapshots_deleted = row_count;

    delete from public.turn_log_entries
    where world_id = p_world_id
      and turn_transition_id in (
        select id from public.turn_transitions
        where world_id = p_world_id
          and to_turn_number < v_cutoff_turn
      );
    get diagnostics v_log_entries_deleted = row_count;

    if p_prune_notifications then
      delete from public.notifications
      where world_id = p_world_id
        and created_at < (now () - (v_current_turn - v_cutoff_turn) * interval '1 day');
      get diagnostics v_notifications_deleted = row_count;
    end if;
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

-- Revoke and re-grant to cover the new signature
revoke all on function public.prune_old_snapshots_and_logs (uuid, integer, boolean, boolean)
from
  public;

grant
execute on function public.prune_old_snapshots_and_logs (uuid, integer, boolean, boolean) to authenticated;
