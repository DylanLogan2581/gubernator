-- pgTAP tests for internal_effective_retention() and the memory_retention_turns
-- column on world_retention_config.
--
-- UUID prefix map (c4-prefixed range, distinct from prune_old_snapshots_and_logs_test.sql):
--   c4800000 = worlds
begin;

select
  plan (3);

-- ---------------------------------------------------------------------------
-- Setup: a world with no world_retention_config row
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'c4800000-0000-0000-0000-000000000001',
    'Retention Defaults Test World',
    500,
    'active'
  );

-- ---------------------------------------------------------------------------
-- Test 1: no config row -> defaults (log=200, snapshot=200, memory=NULL)
-- ---------------------------------------------------------------------------
select
  results_eq (
    $$
    select * from public.internal_effective_retention('c4800000-0000-0000-0000-000000000001'::uuid)
    $$,
    $$values (200::integer, 200::integer, null::integer)$$,
    'internal_effective_retention returns defaults (200, 200, NULL) when no config row exists'
  );

-- ---------------------------------------------------------------------------
-- Test 2: config row present -> resolved values (log=10, snapshot=5, memory=50)
-- ---------------------------------------------------------------------------
insert into
  public.world_retention_config (
    world_id,
    log_retention_turns,
    snapshot_retention_turns,
    memory_retention_turns
  )
values
  ('c4800000-0000-0000-0000-000000000001', 10, 5, 50);

select
  results_eq (
    $$
    select * from public.internal_effective_retention('c4800000-0000-0000-0000-000000000001'::uuid)
    $$,
    $$values (10::integer, 5::integer, 50::integer)$$,
    'internal_effective_retention returns configured values (10, 5, 50) when config row exists'
  );

-- ---------------------------------------------------------------------------
-- Test 3: memory_retention_turns check constraint rejects values < 1
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $$
      update public.world_retention_config
      set memory_retention_turns = 0
      where world_id = 'c4800000-0000-0000-0000-000000000001'
    $$,
    '23514',
    null,
    'memory_retention_turns check constraint rejects 0'
  );

select
  *
from
  finish ();

rollback;
