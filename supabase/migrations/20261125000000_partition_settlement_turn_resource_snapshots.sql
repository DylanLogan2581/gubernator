-- Migration: partition_settlement_turn_resource_snapshots
--
-- Task 1.6a of the DB scaling roadmap. Converts the highest-multiplier per-turn
-- append table (settlements x resources x turns) into a two-level partitioned
-- table:
--   PARTITION BY LIST (world_id)  -- one partition per world (physical isolation)
--     -> each world PARTITION BY RANGE (turn_number) in 100-turn windows
--   + a DEFAULT partition as a catch-all safety net so an insert can never fail
--     for a missing world partition.
--
-- This sets up O(1) drop-based retention (the DROP wiring is a later task, 1.6c).
-- Batched-DELETE retention (internal_prune_world_retention) keeps working.
--
-- CRITICAL RETENTION FIX (in scope for this task, authorized): the shared
-- retention helper internal_prune_batch_delete batched deletes via
--   delete from t where ctid in (select ctid from t where <pred> limit N)
-- On a NON-partitioned table ctid is unique, so this is correct. On a
-- PARTITIONED table ctid is only unique within each partition heap, so the
-- predicate-less outer delete would match equal-ctid rows in OTHER partitions
-- (other worlds / newer turn-windows) -> silent cross-world data loss under the
-- nightly pg_cron retention sweep. Fixed here by identifying rows with the
-- partition-global key (tableoid, ctid). Behaviour is identical on the existing
-- non-partitioned append tables (tableoid is constant there).
--
-- Structure-only change: same 14 columns/types/defaults, same RLS/grants posture,
-- same ON CONFLICT dedup semantics; the turn engine and every existing test must
-- still pass. No simulation-output change.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Step 0: make the shared batched-delete helper partition-safe.
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
    -- Identify the batch by (tableoid, ctid): ctid alone is not unique across
    -- partitions, so a partition-global identifier is required to avoid deleting
    -- equal-ctid rows in sibling partitions. On non-partitioned tables tableoid
    -- is constant, so this is equivalent to the previous ctid-only form.
    execute format (
      'delete from %s where (tableoid, ctid) in (select tableoid, ctid from %s where %s limit %s)',
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

comment on function public.internal_prune_batch_delete (regclass, text, integer, boolean) is 'Internal shared batched-delete helper for retention pruning. Deletes rows matching p_predicate from p_table in p_batch_limit-sized loops, identifying each batch by (tableoid, ctid) so it is correct on partitioned tables (ctid is not unique across partitions). Accumulates the total deleted (or counts them, unchanged, when p_dry_run). Predicate text must only ever be built by trusted internal callers from typed values -- never from raw user input. Not granted to authenticated.';

-- ---------------------------------------------------------------------------
-- Step 0b: helper that enables RLS and replicates the four table policies on a
-- single partition. Child partitions are ordinary tables in schema public and
-- receive Supabase's default authenticated grants, so without their own RLS an
-- authenticated user could SELECT a partition directly and bypass the parent's
-- world-access policy. Applying the same policies to every partition closes that
-- hole and keeps the rls_meta_test invariant (every public table has RLS + a
-- policy) satisfied for dynamically-created partitions. Parent-routed queries
-- still use only the parent's policies (Postgres does not double-apply child
-- policies), so this does not change normal access semantics.
-- ---------------------------------------------------------------------------
create or replace function public.internal_secure_str_snapshot_partition (p_partition regclass) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  execute format('alter table %s enable row level security', p_partition);
  execute format('create policy "settlement_turn_resource_snapshots_select_world_access" on %s for select to authenticated using (public.current_user_has_world_access(world_id))', p_partition);
  execute format('create policy "settlement_turn_resource_snapshots_insert_world_admin" on %s for insert to authenticated with check (public.is_world_admin(world_id) or public.is_super_admin())', p_partition);
  execute format('create policy "settlement_turn_resource_snapshots_update_super_admin" on %s for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', p_partition);
  execute format('create policy "settlement_turn_resource_snapshots_delete_super_admin" on %s for delete to authenticated using (public.is_super_admin())', p_partition);
  -- Append-only posture: child partitions are ordinary public tables that keep
  -- Supabase's default broad authenticated/anon write grants. The parent revokes
  -- direct INSERT/UPDATE (writes go only through the SECURITY DEFINER RPC); the
  -- same must hold on every child or a world admin could POST directly to a
  -- partition (whose insert policy permits world admins) and fabricate snapshot
  -- rows, bypassing the RPC-only write path. Fully revoke direct writes on children.
  execute format('revoke insert, update, delete on %s from authenticated, anon', p_partition);
end;
$$;

comment on function public.internal_secure_str_snapshot_partition (regclass) is 'Internal: enables RLS and creates the four settlement_turn_resource_snapshots policies on one partition, so direct partition access has the same security posture as the parent. Not granted to authenticated.';

revoke all on function public.internal_secure_str_snapshot_partition (regclass)
from
  public;

revoke
execute on function public.internal_secure_str_snapshot_partition (regclass)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- Step 1: new partitioned parent (temporary name settlement_turn_resource_snapshots_p).
-- Index-backed constraint names (PK, UNIQUE) must be temporary because index
-- names are schema-unique and the old table still owns the canonical names until
-- it is dropped in step 5. FK constraint names are per-table, so they take their
-- final names directly.
-- ---------------------------------------------------------------------------
create table public.settlement_turn_resource_snapshots_p (
  id uuid not null default gen_random_uuid(),
  turn_transition_id uuid,
  world_id uuid not null,
  settlement_id uuid not null,
  resource_id uuid not null,
  turn_number integer not null,
  quantity_before numeric(18, 4) not null default 0,
  quantity_after numeric(18, 4) not null default 0,
  produced_amount numeric(18, 4) not null default 0,
  consumed_amount numeric(18, 4) not null default 0,
  trade_in_amount numeric(18, 4) not null default 0,
  trade_out_amount numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  adjustment_amount numeric(18, 4) not null default 0,
  constraint str_snapshots_pkey_tmp primary key (world_id, turn_number, id),
  constraint str_snapshots_unique_tmp unique (
    world_id,
    turn_number,
    turn_transition_id,
    settlement_id,
    resource_id
  ),
  constraint settlement_turn_resource_snapshots_world_id_fkey foreign key (world_id) references public.worlds (id) on delete cascade,
  constraint settlement_turn_resource_snapshots_settlement_id_fkey foreign key (settlement_id) references public.settlements (id) on delete cascade,
  constraint settlement_turn_resource_snapshots_resource_id_fkey foreign key (resource_id) references public.resources (id) on delete cascade,
  constraint settlement_turn_resource_snapshots_transition_world_fkey foreign key (turn_transition_id, world_id) references public.turn_transitions (id, world_id) on delete cascade
)
partition by
  list (world_id);

comment on column public.settlement_turn_resource_snapshots_p.turn_transition_id is 'Nullable to allow §6c baseline backfill snapshots created before the first recorded turn transition.';

comment on column public.settlement_turn_resource_snapshots_p.adjustment_amount is 'Admin stockpile edit recorded between the previous turn and this turn, computed as quantity_before[N] - quantity_after[N-1]. Zero for the first snapshot or when no admin edit occurred between turns.';

-- Catch-all DEFAULT partition (plain table): any world without an explicit
-- partition lands here so a direct insert can never fail for a missing partition.
create table public.settlement_turn_resource_snapshots_p_default partition of public.settlement_turn_resource_snapshots_p default;

select
  public.internal_secure_str_snapshot_partition (
    'public.settlement_turn_resource_snapshots_p_default'::regclass
  );

-- ---------------------------------------------------------------------------
-- Step 2: create per-world LIST partitions (RANGE-subpartitioned by turn_number,
-- 100-turn windows) covering every existing world that has rows. Window k covers
-- [k*100, (k+1)*100). Names match ensure_str_snapshot_partitions so runtime and
-- backfill agree.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world      record;
  v_min        integer;
  v_max        integer;
  v_k          integer;
  v_hex        text;
  v_world_part text;
  v_win_part   text;
begin
  for v_world in
    select distinct world_id
    from public.settlement_turn_resource_snapshots
  loop
    select min(turn_number), max(turn_number)
      into v_min, v_max
    from public.settlement_turn_resource_snapshots
    where world_id = v_world.world_id;

    if v_min is null then
      continue;
    end if;

    v_hex        := replace(v_world.world_id::text, '-', '');
    v_world_part := 'str_snap_w_' || v_hex;

    execute format(
      'create table public.%I partition of public.settlement_turn_resource_snapshots_p '
      || 'for values in (%L) partition by range (turn_number)',
      v_world_part, v_world.world_id
    );
    perform public.internal_secure_str_snapshot_partition(('public.' || v_world_part)::regclass);

    v_k := (floor(v_min::numeric / 100))::integer;
    while v_k <= (floor(v_max::numeric / 100))::integer loop
      v_win_part := v_world_part || '_t' || (v_k * 100)::text;
      execute format(
        'create table public.%I partition of public.%I for values from (%L) to (%L)',
        v_win_part, v_world_part, v_k * 100, (v_k + 1) * 100
      );
      perform public.internal_secure_str_snapshot_partition(('public.' || v_win_part)::regclass);
      v_k := v_k + 1;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 3: copy all rows (columns in table order) into the partitioned table.
-- ---------------------------------------------------------------------------
insert into
  public.settlement_turn_resource_snapshots_p (
    id,
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after,
    produced_amount,
    consumed_amount,
    trade_in_amount,
    trade_out_amount,
    created_at,
    adjustment_amount
  )
select
  id,
  turn_transition_id,
  world_id,
  settlement_id,
  resource_id,
  turn_number,
  quantity_before,
  quantity_after,
  produced_amount,
  consumed_amount,
  trade_in_amount,
  trade_out_amount,
  created_at,
  adjustment_amount
from
  public.settlement_turn_resource_snapshots;

-- ---------------------------------------------------------------------------
-- Step 4: integrity self-check. ABORT (raise) if row counts or column checksums
-- differ, BEFORE the old table is dropped. If this fails the whole transaction
-- rolls back and the old table survives untouched.
-- ---------------------------------------------------------------------------
do $$
declare
  v_old_count  bigint;
  v_new_count  bigint;
  v_old_before numeric;
  v_new_before numeric;
  v_old_after  numeric;
  v_new_after  numeric;
  v_old_flow   numeric;
  v_new_flow   numeric;
  v_old_digest numeric;
  v_new_digest numeric;
begin
  select count(*),
         coalesce(sum(quantity_before), 0),
         coalesce(sum(quantity_after), 0),
         coalesce(sum(produced_amount + consumed_amount + trade_in_amount
                      + trade_out_amount + adjustment_amount), 0),
         -- Order-independent set digest over the key columns: catches a
         -- key-mismatched / mis-copied row even when numeric totals still tie.
         coalesce(sum(hashtextextended(
           id::text || '|' || coalesce(turn_transition_id::text, '') || '|'
           || settlement_id::text || '|' || resource_id::text || '|'
           || turn_number::text, 0)), 0)
    into v_old_count, v_old_before, v_old_after, v_old_flow, v_old_digest
  from public.settlement_turn_resource_snapshots;

  select count(*),
         coalesce(sum(quantity_before), 0),
         coalesce(sum(quantity_after), 0),
         coalesce(sum(produced_amount + consumed_amount + trade_in_amount
                      + trade_out_amount + adjustment_amount), 0),
         coalesce(sum(hashtextextended(
           id::text || '|' || coalesce(turn_transition_id::text, '') || '|'
           || settlement_id::text || '|' || resource_id::text || '|'
           || turn_number::text, 0)), 0)
    into v_new_count, v_new_before, v_new_after, v_new_flow, v_new_digest
  from public.settlement_turn_resource_snapshots_p;

  if v_old_count <> v_new_count
     or v_old_before <> v_new_before
     or v_old_after <> v_new_after
     or v_old_flow <> v_new_flow
     or v_old_digest <> v_new_digest then
    raise exception 'settlement_turn_resource_snapshots partition integrity check FAILED: '
      'count(old=%, new=%), sum_before(old=%, new=%), sum_after(old=%, new=%), sum_flow(old=%, new=%), digest(old=%, new=%)',
      v_old_count, v_new_count, v_old_before, v_new_before,
      v_old_after, v_new_after, v_old_flow, v_new_flow, v_old_digest, v_new_digest;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 5: drop the dependent aggregate views, then the old table (frees the
-- canonical table / index / constraint names). Views are recreated in step 9.
-- ---------------------------------------------------------------------------
drop view if exists public.nation_turn_resource_aggregates;

drop view if exists public.world_turn_resource_aggregates;

drop table public.settlement_turn_resource_snapshots;

-- ---------------------------------------------------------------------------
-- Step 6: rename the new parent and its index-backed constraints to canonical.
-- (RENAME CONSTRAINT on PK/UNIQUE also renames the backing index.)
-- ---------------------------------------------------------------------------
alter table public.settlement_turn_resource_snapshots_p
rename to settlement_turn_resource_snapshots;

alter table public.settlement_turn_resource_snapshots
rename constraint str_snapshots_pkey_tmp to settlement_turn_resource_snapshots_pkey;

alter table public.settlement_turn_resource_snapshots
rename constraint str_snapshots_unique_tmp to settlement_turn_resource_snapshots_unique;

-- ---------------------------------------------------------------------------
-- Step 7: non-unique indexes on the parent (propagate to all partitions).
-- ---------------------------------------------------------------------------
create index settlement_turn_resource_snapshots_transition_settlement_idx on public.settlement_turn_resource_snapshots (turn_transition_id, settlement_id);

create index settlement_turn_resource_snapshots_settlement_resource_turn_idx on public.settlement_turn_resource_snapshots (settlement_id, resource_id, turn_number desc);

create index settlement_turn_resource_snapshots_world_turn_idx on public.settlement_turn_resource_snapshots (world_id, turn_number desc);

-- ---------------------------------------------------------------------------
-- Step 8: RLS + grants. Reproduces the exact net posture of migrations
-- 20260602000003, 20260604000004 and 20260730000000 by replaying their
-- grant/revoke statements in order on the recreated table (which inherits the
-- same Supabase default privileges on creation).
-- ---------------------------------------------------------------------------
alter table public.settlement_turn_resource_snapshots enable row level security;

create policy "settlement_turn_resource_snapshots_select_world_access" on public.settlement_turn_resource_snapshots for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "settlement_turn_resource_snapshots_insert_world_admin" on public.settlement_turn_resource_snapshots for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "settlement_turn_resource_snapshots_update_super_admin" on public.settlement_turn_resource_snapshots
for update
  to authenticated using (public.is_super_admin ())
with
  check (public.is_super_admin ());

create policy "settlement_turn_resource_snapshots_delete_super_admin" on public.settlement_turn_resource_snapshots for delete to authenticated using (public.is_super_admin ());

-- Grant posture (net of the three source migrations, replayed in order):
--   20260602000003: revoke insert,update; grant insert on the 12 original columns.
revoke insert,
update on public.settlement_turn_resource_snapshots
from
  authenticated;

grant insert (
  id,
  turn_transition_id,
  world_id,
  settlement_id,
  resource_id,
  turn_number,
  quantity_before,
  quantity_after,
  produced_amount,
  consumed_amount,
  trade_in_amount,
  trade_out_amount
) on public.settlement_turn_resource_snapshots to authenticated;

--   20260604000004: revoke the column-level INSERT grant entirely.
revoke insert on public.settlement_turn_resource_snapshots
from
  authenticated;

--   20260730000000: grant column-level INSERT on adjustment_amount only.
grant insert (adjustment_amount) on public.settlement_turn_resource_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- Step 9: recreate the two aggregate views verbatim from 20260730000000
-- (SECURITY INVOKER; net_amount includes adjustment_amount).
-- ---------------------------------------------------------------------------
create view public.nation_turn_resource_aggregates
with
  (security_invoker = true) as
select
  sts.world_id,
  s.nation_id,
  sts.turn_number,
  sts.resource_id,
  r.name as resource_name,
  sum(sts.produced_amount) as produced_amount,
  sum(sts.consumed_amount) as consumed_amount,
  sum(sts.trade_in_amount) as trade_in_amount,
  sum(sts.trade_out_amount) as trade_out_amount,
  sum(sts.adjustment_amount) as adjustment_amount,
  sum(
    sts.produced_amount - sts.consumed_amount + sts.trade_in_amount - sts.trade_out_amount + sts.adjustment_amount
  ) as net_amount
from
  public.settlement_turn_resource_snapshots sts
  join public.settlements s on s.id = sts.settlement_id
  join public.resources r on r.id = sts.resource_id
group by
  sts.world_id,
  s.nation_id,
  sts.turn_number,
  sts.resource_id,
  r.name;

comment on view public.nation_turn_resource_aggregates is 'Per-nation-per-turn-per-resource sums from settlement_turn_resource_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables. net_amount includes adjustment_amount for full reconciliation.';

grant
select
  on public.nation_turn_resource_aggregates to authenticated;

create view public.world_turn_resource_aggregates
with
  (security_invoker = true) as
select
  sts.world_id,
  sts.turn_number,
  sts.resource_id,
  r.name as resource_name,
  sum(sts.produced_amount) as produced_amount,
  sum(sts.consumed_amount) as consumed_amount,
  sum(sts.trade_in_amount) as trade_in_amount,
  sum(sts.trade_out_amount) as trade_out_amount,
  sum(sts.adjustment_amount) as adjustment_amount,
  sum(
    sts.produced_amount - sts.consumed_amount + sts.trade_in_amount - sts.trade_out_amount + sts.adjustment_amount
  ) as net_amount
from
  public.settlement_turn_resource_snapshots sts
  join public.resources r on r.id = sts.resource_id
group by
  sts.world_id,
  sts.turn_number,
  sts.resource_id,
  r.name;

comment on view public.world_turn_resource_aggregates is 'Per-world-per-turn-per-resource sums from settlement_turn_resource_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables. net_amount includes adjustment_amount for full reconciliation.';

grant
select
  on public.world_turn_resource_aggregates to authenticated;

-- ---------------------------------------------------------------------------
-- Step 10: ensure_str_snapshot_partitions -- idempotently creates a world's LIST
-- partition (RANGE-subpartitioned) and the 100-turn window covering p_turn_number.
-- Called at the top of the insert helper so the target partition always exists
-- before insert. Safe to call every turn. Not granted to authenticated.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_str_snapshot_partitions (p_world_id uuid, p_turn_number integer) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_hex          text := replace(p_world_id::text, '-', '');
  v_world_part   text := 'str_snap_w_' || v_hex;
  v_window_start integer := (floor(p_turn_number::numeric / 100) * 100)::integer;
  v_window_end   integer := (floor(p_turn_number::numeric / 100) * 100)::integer + 100;
  v_window_part  text := 'str_snap_w_' || v_hex || '_t' || ((floor(p_turn_number::numeric / 100) * 100)::integer)::text;
begin
  -- World LIST partition (itself RANGE-subpartitioned by turn_number).
  if to_regclass('public.' || v_world_part) is null then
    begin
      execute format(
        'create table public.%I partition of public.settlement_turn_resource_snapshots '
        || 'for values in (%L) partition by range (turn_number)',
        v_world_part, p_world_id
      );
      perform public.internal_secure_str_snapshot_partition(('public.' || v_world_part)::regclass);
    exception
      when duplicate_table then null;   -- created concurrently; fine
      when duplicate_object then null;  -- policy already present (race); fine
      when check_violation then null;   -- rows already sit in the DEFAULT partition; leave them there
    end;
  end if;

  -- 100-turn window sub-partition covering p_turn_number, only if the world's
  -- LIST partition exists (otherwise the row falls through to the DEFAULT partition).
  if to_regclass('public.' || v_world_part) is not null
     and to_regclass('public.' || v_window_part) is null then
    begin
      execute format(
        'create table public.%I partition of public.%I for values from (%L) to (%L)',
        v_window_part, v_world_part, v_window_start, v_window_end
      );
      perform public.internal_secure_str_snapshot_partition(('public.' || v_window_part)::regclass);
    exception
      when duplicate_table then null;   -- created concurrently; fine
      when duplicate_object then null;  -- policy already present (race); fine
    end;
  end if;
end;
$$;

comment on function public.ensure_str_snapshot_partitions (uuid, integer) is 'Internal: idempotently ensures the LIST partition for p_world_id and the 100-turn RANGE window covering p_turn_number exist on settlement_turn_resource_snapshots. Called at the top of internal_apply_turn_transition_stockpile_deltas so the target partition always exists before insert. Safe to call every turn. Not granted to authenticated.';

revoke all on function public.ensure_str_snapshot_partitions (uuid, integer)
from
  public;

revoke
execute on function public.ensure_str_snapshot_partitions (uuid, integer)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- Step 11: re-create the insert helper (latest body from
-- 20260730000000:107-209) with a single ensure_str_snapshot_partitions call at
-- the top; all other logic is preserved byte-for-byte.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_stockpile_deltas (
  p_transition_id uuid,
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_delta              jsonb;
  v_settlement_id      uuid;
  v_resource_id        uuid;
  v_quantity_before    numeric(18, 4);
  v_quantity_after     numeric(18, 4);
  v_produced_amount    numeric(18, 4);
  v_consumed_amount    numeric(18, 4);
  v_trade_in_amount    numeric(18, 4);
  v_trade_out_amount   numeric(18, 4);
  v_effective_cap      numeric;
  v_clamped_quantity   numeric(18, 4);
  v_prev_qty_after     numeric(18, 4);
  v_adjustment_amount  numeric(18, 4);
  v_count              integer := 0;
begin
  -- Ensure the target world/turn partition exists before any insert below.
  perform public.ensure_str_snapshot_partitions(p_world_id, p_expected_turn_number);

  for v_delta in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_settlement_id    := (v_delta ->> 'settlementId')::uuid;
    v_resource_id      := (v_delta ->> 'resourceId')::uuid;
    v_quantity_before  := coalesce((v_delta ->> 'quantityBefore')::numeric, 0);
    v_quantity_after   := coalesce((v_delta ->> 'quantityAfter')::numeric, 0);
    v_produced_amount  := coalesce((v_delta ->> 'produced')::numeric, 0);
    v_consumed_amount  := coalesce((v_delta ->> 'consumed')::numeric, 0);
    v_trade_in_amount  := coalesce((v_delta ->> 'tradeIn')::numeric, 0);
    v_trade_out_amount := coalesce((v_delta ->> 'tradeOut')::numeric, 0);

    -- Server-side clamp to [0, effective_cap] (defence-in-depth; engine already clamps).
    -- Use _internal variant: auth was already verified by the orchestrator.
    v_effective_cap    := public.settlement_effective_storage_cap_internal(v_settlement_id, v_resource_id);
    v_clamped_quantity := greatest(0, least(v_quantity_after, v_effective_cap));

    -- Look up the previous turn's quantity_after for this settlement+resource.
    -- Non-NULL only when a prior snapshot exists; NULL = first snapshot.
    -- The index on (settlement_id, resource_id, turn_number DESC) makes this fast.
    select quantity_after
    into v_prev_qty_after
    from public.settlement_turn_resource_snapshots
    where settlement_id = v_settlement_id
      and resource_id   = v_resource_id
      and world_id      = p_world_id
      and turn_number   = p_expected_turn_number - 1
    limit 1;

    -- adjustment_amount = gap between this turn's starting quantity and the
    -- previous turn's ending quantity. Non-zero only when an admin called
    -- set_settlement_stockpile_quantity between turns. Zero for the first snapshot.
    v_adjustment_amount := v_quantity_before - coalesce(v_prev_qty_after, v_quantity_before);

    update public.settlement_resource_stockpiles
    set
      quantity = v_clamped_quantity
    where
      settlement_id = v_settlement_id
      and resource_id = v_resource_id;

    insert into
      public.settlement_turn_resource_snapshots (
        turn_transition_id,
        world_id,
        settlement_id,
        resource_id,
        turn_number,
        quantity_before,
        quantity_after,
        produced_amount,
        consumed_amount,
        trade_in_amount,
        trade_out_amount,
        adjustment_amount
      )
    values
      (
        p_transition_id,
        p_world_id,
        v_settlement_id,
        v_resource_id,
        p_expected_turn_number,
        v_quantity_before,
        v_clamped_quantity,
        v_produced_amount,
        v_consumed_amount,
        v_trade_in_amount,
        v_trade_out_amount,
        v_adjustment_amount
      ) on conflict on constraint settlement_turn_resource_snapshots_unique do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  public;
