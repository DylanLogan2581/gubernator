-- pgTAP tests for snapshot/log retention pruning RPC.
-- Tests: prune_old_snapshots_and_logs with various scenarios.
--
-- UUID prefix map (c4-prefixed ranges, unique to this file):
--   c4100000 = users        c4200000 = worlds
--   c4300000 = nations      c4400000 = settlements
--   c4500000 = resources    c4600000 = turns
begin;

select
  plan (10);

-- ---------------------------------------------------------------------------
-- Setup: super_admin user
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'c4100000-0000-0000-0000-000000000001',
    'prune-superadmin@example.com',
    'x',
    now(),
    '{"username":"prune_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c4100000-0000-0000-0000-000000000001';

-- prune_old_snapshots_and_logs requires world_admin or super_admin. Assume the
-- super_admin identity via jwt claims so is_super_admin() resolves true. Role
-- stays postgres so fixture inserts and verification selects bypass RLS.
set
  local "request.jwt.claims" = '{"sub":"c4100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- World with current_turn_number = 110
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'c4200000-0000-0000-0000-000000000001',
    'Prune Test World',
    110,
    'private',
    'active'
  );

-- Nation and settlements
insert into
  public.nations (id, world_id, name)
values
  (
    'c4300000-0000-0000-0000-000000000001',
    'c4200000-0000-0000-0000-000000000001',
    'Prune Test Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4400000-0000-0000-0000-000000000001',
    'c4300000-0000-0000-0000-000000000001',
    'Prune Test Settlement'
  );

-- Resources
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c4500000-0000-0000-0000-000000000001',
    'c4200000-0000-0000-0000-000000000001',
    'Resource 1',
    'resource-1'
  ),
  (
    'c4500000-0000-0000-0000-000000000002',
    'c4200000-0000-0000-0000-000000000001',
    'Resource 2',
    'resource-2'
  );

-- ---------------------------------------------------------------------------
-- Fixtures: turn_transitions and snapshots across turns 1-110
-- ---------------------------------------------------------------------------
-- We'll insert snapshots for turns: 10, 30, 50, 70, 90, 100, 110
-- With retention_turns=50, cutoff=60, should prune turns < 60 (10, 30, 50)
-- should keep turns >= 60 (70, 90, 100, 110)
do $$
declare
  v_turn_num integer;
  v_transition_id uuid;
  v_settlement_snapshot_id uuid;
  v_resource_snapshot_id uuid;
begin
  foreach v_turn_num in array array[10, 30, 50, 70, 90, 100, 110] loop
    -- Insert turn_transition (status='completed' so it's eligible for pruning)
    insert into public.turn_transitions (
      id, world_id, from_turn_number, to_turn_number, initiated_by_user_id, status
    )
    values (
      gen_random_uuid(),
      'c4200000-0000-0000-0000-000000000001',
      v_turn_num - 1,
      v_turn_num,
      'c4100000-0000-0000-0000-000000000001',
      'completed'
    )
    returning id into v_transition_id;

    -- Insert settlement_turn_snapshots
    insert into public.settlement_turn_snapshots (
      id, turn_transition_id, world_id, settlement_id, turn_number,
      population_total, population_npc, population_player_character, population_cap
    )
    values (
      gen_random_uuid(),
      v_transition_id,
      'c4200000-0000-0000-0000-000000000001',
      'c4400000-0000-0000-0000-000000000001',
      v_turn_num,
      100, 80, 20, 150
    );

    -- Insert settlement_turn_resource_snapshots (one per resource)
    insert into public.settlement_turn_resource_snapshots (
      id, turn_transition_id, world_id, settlement_id, resource_id, turn_number,
      quantity_before, quantity_after
    )
    select
      gen_random_uuid(),
      v_transition_id,
      'c4200000-0000-0000-0000-000000000001',
      'c4400000-0000-0000-0000-000000000001',
      r.id,
      v_turn_num,
      100.0, 150.0
    from (
      select id from public.resources where id in (
        'c4500000-0000-0000-0000-000000000001',
        'c4500000-0000-0000-0000-000000000002'
      )
    ) r;

    -- Insert turn_log_entries
    insert into public.turn_log_entries (
      id, turn_transition_id, world_id, settlement_id, log_category
    )
    values
      (gen_random_uuid(), v_transition_id, 'c4200000-0000-0000-0000-000000000001', 'c4400000-0000-0000-0000-000000000001', 'test_log'),
      (gen_random_uuid(), v_transition_id, 'c4200000-0000-0000-0000-000000000001', 'c4400000-0000-0000-0000-000000000001', 'test_log');
  end loop;
end;
$$;

-- Verify setup
select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots
      where
        world_id = 'c4200000-0000-0000-0000-000000000001'
    ),
    7::bigint,
    'Inserted 7 settlement snapshots (one per turn)'
  );

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'c4200000-0000-0000-0000-000000000001'
    ),
    14::bigint,
    'Inserted 14 resource snapshots (2 resources × 7 turns)'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'c4200000-0000-0000-0000-000000000001'
    ),
    14::bigint,
    'Inserted 14 log entries (2 per turn × 7 turns)'
  );

-- ---------------------------------------------------------------------------
-- Test 1: Prune with retention_turns=50 (cutoff=60)
-- Should prune turns 10, 30, 50; keep 70, 90, 100, 110
-- A single prune call deletes settlement snapshots, resource snapshots, and log
-- entries together, so capture its result once and assert against each field.
-- ---------------------------------------------------------------------------
create temp table prune_result_t1 as
select
  prune_old_snapshots_and_logs ('c4200000-0000-0000-0000-000000000001', 50) as result;

select
  is (
    (
      select
        (result -> 'snapshots_deleted')::int
      from
        prune_result_t1
    ),
    3::int,
    'Prune with retention=50: deletes 3 settlement snapshots (turns 10, 30, 50)'
  );

select
  is (
    (
      select
        (result -> 'resource_snapshots_deleted')::int
      from
        prune_result_t1
    ),
    6::int,
    'Prune with retention=50: deletes 6 resource snapshots (2 per turn × 3 turns)'
  );

-- Verify remaining snapshots are turns >= 60
select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots
      where
        world_id = 'c4200000-0000-0000-0000-000000000001'
        and turn_number >= 60
    ),
    4::bigint,
    'After prune: 4 settlement snapshots remain (turns 70, 90, 100, 110)'
  );

-- ---------------------------------------------------------------------------
-- Test 2: Verify pruning doesn't affect future turns
-- ---------------------------------------------------------------------------
insert into
  public.settlement_turn_snapshots (
    id,
    world_id,
    settlement_id,
    turn_number,
    population_total,
    population_npc,
    population_player_character,
    population_cap
  )
values
  (
    gen_random_uuid(),
    'c4200000-0000-0000-0000-000000000001',
    'c4400000-0000-0000-0000-000000000001',
    120,
    100,
    80,
    20,
    150
  );

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots
      where
        world_id = 'c4200000-0000-0000-0000-000000000001'
    ),
    5::bigint,
    'After inserting turn 120 snapshot, total is 5 (4 kept + 1 new)'
  );

-- Verify log entries are pruned (initial count was 14, prune deletes 6 for turns 10,30,50)
select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'c4200000-0000-0000-0000-000000000001'
    ),
    8::bigint,
    'After prune: 8 log entries remain (2 per turn × 4 kept turns)'
  );

-- ---------------------------------------------------------------------------
-- Test 3: Idempotency (second prune call with same retention)
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        (
          prune_old_snapshots_and_logs ('c4200000-0000-0000-0000-000000000001', 50) -> 'snapshots_deleted'
        )::int
    ),
    0::int,
    'Second prune call (same retention): no rows deleted (already pruned)'
  );

-- ---------------------------------------------------------------------------
-- Test 4: Edge case - retention_turns > current_turn (no pruning)
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'c4200000-0000-0000-0000-000000000002',
    'Young World',
    5,
    'private',
    'active'
  );

select
  is (
    (
      select
        prune_old_snapshots_and_logs ('c4200000-0000-0000-0000-000000000002', 100) ->> 'message'
    ),
    'No pruning: world has < 100 turns',
    'Prune with retention > current_turn: returns early with message'
  );

select
  *
from
  finish ();

rollback;
