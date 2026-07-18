-- pgTAP tests for Task 1.6c: partition-DROP retention of
-- public.settlement_turn_resource_snapshots.
--
-- internal_drop_elapsed_str_snapshot_partitions(world, cutoff, dry_run) must DROP
-- every RANGE sub-partition whose upper bound <= cutoff (entirely elapsed), leave
-- the boundary window (whose range contains the cutoff) for the batched DELETE,
-- and never touch another world's partitions. internal_prune_world_retention must
-- call it, then batched-delete the boundary window's remaining old rows, so the
-- net settlement_turn_resource_snapshots_deleted = dropped-rows + boundary-deleted.
--
-- Layout: World A current_turn 350, snapshot_retention_turns 100 => cutoff 250,
-- which falls INSIDE window t200 [200,300). So:
--   t0   [0,100)   upper 100 <= 250  -> DROP        (row turn 5)
--   t100 [100,200) upper 200 <= 250  -> DROP        (row turn 150)
--   t200 [200,300) upper 300 >  250  -> boundary     (turn 220 deleted, turn 280 kept)
--   t300 [300,400) upper 400 >  250  -> kept         (row turn 349)
-- World B current_turn 50 stays entirely untouched.
--
-- UUID ranges (unique to this file):
--   e2xxxxxx = worlds   e3xxxxxx = nations   e4xxxxxx = settlements
--   e6xxxxxx = resources
begin;

select
  plan (20);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'e2000000-0000-0000-0000-00000000000a',
    'Drop Retention World A',
    350,
    'active'
  ),
  (
    'e2000000-0000-0000-0000-00000000000b',
    'Drop Retention World B',
    50,
    'active'
  );

-- World A keeps only the last 100 turns of snapshots => cutoff 250.
insert into
  public.world_retention_config (world_id, snapshot_retention_turns)
values
  ('e2000000-0000-0000-0000-00000000000a', 100);

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-00000000000a',
    'Nation A'
  ),
  (
    'e3000000-0000-0000-0000-00000000000b',
    'e2000000-0000-0000-0000-00000000000b',
    'Nation B'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-00000000000a',
    'e3000000-0000-0000-0000-00000000000a',
    'Settlement A'
  ),
  (
    'e4000000-0000-0000-0000-00000000000b',
    'e3000000-0000-0000-0000-00000000000b',
    'Settlement B'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'e6000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-00000000000a',
    'Drop Grain A',
    'drop-grain-a'
  ),
  (
    'e6000000-0000-0000-0000-00000000000b',
    'e2000000-0000-0000-0000-00000000000b',
    'Drop Grain B',
    'drop-grain-b'
  );

-- Create sub-partitions the way the turn engine does, then insert directly
-- (postgres role bypasses RLS/grants, mirroring the SECURITY DEFINER RPC).
select
  public.ensure_str_snapshot_partitions ('e2000000-0000-0000-0000-00000000000a', 5);

select
  public.ensure_str_snapshot_partitions ('e2000000-0000-0000-0000-00000000000a', 150);

select
  public.ensure_str_snapshot_partitions ('e2000000-0000-0000-0000-00000000000a', 220);

select
  public.ensure_str_snapshot_partitions ('e2000000-0000-0000-0000-00000000000a', 349);

select
  public.ensure_str_snapshot_partitions ('e2000000-0000-0000-0000-00000000000b', 5);

insert into
  public.settlement_turn_resource_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  -- World A: t0 + t100 fully elapsed (dropped), t200 boundary (220 gone / 280 kept),
  -- t300 kept.
  (
    null,
    'e2000000-0000-0000-0000-00000000000a',
    'e4000000-0000-0000-0000-00000000000a',
    'e6000000-0000-0000-0000-00000000000a',
    5,
    100.0,
    90.0
  ),
  (
    null,
    'e2000000-0000-0000-0000-00000000000a',
    'e4000000-0000-0000-0000-00000000000a',
    'e6000000-0000-0000-0000-00000000000a',
    150,
    100.0,
    90.0
  ),
  (
    null,
    'e2000000-0000-0000-0000-00000000000a',
    'e4000000-0000-0000-0000-00000000000a',
    'e6000000-0000-0000-0000-00000000000a',
    220,
    100.0,
    90.0
  ),
  (
    null,
    'e2000000-0000-0000-0000-00000000000a',
    'e4000000-0000-0000-0000-00000000000a',
    'e6000000-0000-0000-0000-00000000000a',
    280,
    100.0,
    90.0
  ),
  (
    null,
    'e2000000-0000-0000-0000-00000000000a',
    'e4000000-0000-0000-0000-00000000000a',
    'e6000000-0000-0000-0000-00000000000a',
    349,
    100.0,
    90.0
  ),
  -- World B: two rows in window t0 (turns 5 and 20). Must survive a World A prune.
  (
    null,
    'e2000000-0000-0000-0000-00000000000b',
    'e4000000-0000-0000-0000-00000000000b',
    'e6000000-0000-0000-0000-00000000000b',
    5,
    30.0,
    20.0
  ),
  (
    null,
    'e2000000-0000-0000-0000-00000000000b',
    'e4000000-0000-0000-0000-00000000000b',
    'e6000000-0000-0000-0000-00000000000b',
    20,
    30.0,
    20.0
  );

-- Deterministic partition names for reuse below.
-- World A: str_snap_w_<hexA>_t{0,100,200,300}; World B: str_snap_w_<hexB>_t0.
-- ===========================================================================
-- Pre-state: all four World A windows exist as sub-partitions.
-- ===========================================================================
select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t0'
    ) is not null,
    'pre: World A window t0 sub-partition exists'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
    ) is not null,
    'pre: World A window t100 sub-partition exists'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t200'
    ) is not null,
    'pre: World A window t200 (boundary) sub-partition exists'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t300'
    ) is not null,
    'pre: World A window t300 sub-partition exists'
  );

-- ===========================================================================
-- Helper DRY-RUN (cutoff 250): reports the two fully-elapsed windows' rows,
-- drops NOTHING.
-- ===========================================================================
select
  is (
    public.internal_drop_elapsed_str_snapshot_partitions ('e2000000-0000-0000-0000-00000000000a', 250, true),
    2,
    'helper dry-run reports 2 rows in fully-elapsed windows (t0 + t100), cutoff 250'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t0'
    ) is not null,
    'helper dry-run drops nothing: World A window t0 still exists'
  );

-- ===========================================================================
-- Integrated DRY-RUN via internal_prune_world_retention: net deleted count =
-- dropped-rows (2) + boundary-deleted (turn 220 => 1) = 3, but NOTHING changes.
-- ===========================================================================
select
  is (
    (
      public.internal_prune_world_retention ('e2000000-0000-0000-0000-00000000000a', true) ->> 'settlement_turn_resource_snapshots_deleted'
    )::integer,
    3,
    'integrated dry-run reports 3 (2 dropped + 1 boundary-deleted)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'e2000000-0000-0000-0000-00000000000a'
    ),
    5,
    'integrated dry-run deletes/drops nothing: all 5 World A rows remain'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
    ) is not null,
    'integrated dry-run drops nothing: World A window t100 still exists'
  );

-- ===========================================================================
-- REAL RUN via internal_prune_world_retention.
-- ===========================================================================
select
  is (
    (
      public.internal_prune_world_retention ('e2000000-0000-0000-0000-00000000000a', false) ->> 'settlement_turn_resource_snapshots_deleted'
    )::integer,
    3,
    'real run net deleted = 3 (2 dropped rows + 1 boundary-deleted row)'
  );

-- Fully-elapsed sub-partitions are DROPPED, not merely emptied.
select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t0'
    ) is null,
    'World A window t0 sub-partition was DROPPED'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t100'
    ) is null,
    'World A window t100 sub-partition was DROPPED'
  );

-- After the drop, World A's LIST partition retains exactly its two live windows.
select
  is (
    (
      select
        count(*)::integer
      from
        pg_inherits i
      where
        i.inhparent = (
          'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '')
        )::regclass
    ),
    2,
    'World A LIST partition now has exactly 2 child windows (t200, t300)'
  );

-- Boundary window t200 survives; its old rows are batched-deleted, kept rows stay.
select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000a', '-', '') || '_t200'
    ) is not null,
    'boundary window t200 sub-partition survives (not dropped)'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'e2000000-0000-0000-0000-00000000000a'
        and turn_number = 220
    ),
    'boundary window old row (turn 220 < cutoff 250) was deleted'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'e2000000-0000-0000-0000-00000000000a'
        and turn_number = 280
    ),
    'boundary window kept row (turn 280 >= cutoff 250) remains'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'e2000000-0000-0000-0000-00000000000a'
        and turn_number = 349
    ),
    'current window row (turn 349) remains'
  );

-- ===========================================================================
-- World B is entirely untouched: its partition and both rows survive.
-- ===========================================================================
select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000b', '-', '') || '_t0'
    ) is not null,
    'World B window t0 sub-partition is untouched'
  );

select
  ok (
    to_regclass(
      'public.str_snap_w_' || replace('e2000000-0000-0000-0000-00000000000b', '-', '')
    ) is not null,
    'World B LIST partition is untouched'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'e2000000-0000-0000-0000-00000000000b'
    ),
    2,
    'World B rows are entirely untouched by a World A prune'
  );

select
  finish ();

rollback;
