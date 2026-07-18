-- pgTAP tests for internal_prune_world_retention: complete retention coverage
-- across every per-turn append table (snapshot-, log-, and memory-governed),
-- plus the turn_transitions width-trim. Complements
-- prune_old_snapshots_and_logs_test.sql, which covers the superadmin-facing
-- wrapper's backward-compatible 4-table subset.
--
-- UUID prefix map (c7-prefixed range, unique to this file):
--   c7100000 = users        c7200000 = worlds
--   c7300000 = nations      c7400000 = settlements
--   c7500000 = resources    c7600000 = turn_transitions
--   c7700000 = armies/currencies/events   c7800000 = citizens
begin;

select
  plan (40);

-- ---------------------------------------------------------------------------
-- Setup: super_admin user (needed to upsert world_retention_config later)
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
    'c7100000-0000-0000-0000-000000000001',
    'prune-all-superadmin@example.com',
    'x',
    now(),
    '{"username":"prune_all_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c7100000-0000-0000-0000-000000000001';

set
  local "request.jwt.claims" = '{"sub":"c7100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- World at current_turn_number = 300, no retention config row yet: defaults
-- apply (log=200, snapshot=200 -> cutoff=100; memory=NULL -> keep-all).
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'c7200000-0000-0000-0000-000000000001',
    'Prune All Tables World',
    300,
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c7300000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'Prune All Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c7400000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    'Prune All Settlement'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c7500000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'Prune Resource',
    'prune-resource'
  );

-- turn_transitions: one old (to_turn_number=50), one recent (to_turn_number=250),
-- both with readiness_summary_jsonb/forecast_snapshot_jsonb populated so the
-- width-trim assertion has something to null out.
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    readiness_summary_jsonb,
    forecast_snapshot_jsonb
  )
values
  (
    'c7600000-0000-0000-0000-00000000005a',
    'c7200000-0000-0000-0000-000000000001',
    49,
    50,
    'c7100000-0000-0000-0000-000000000001',
    'completed',
    '{"ready": true}'::jsonb,
    '{"forecast": "old"}'::jsonb
  ),
  (
    'c7600000-0000-0000-0000-0000000000fa',
    'c7200000-0000-0000-0000-000000000001',
    249,
    250,
    'c7100000-0000-0000-0000-000000000001',
    'completed',
    '{"ready": true}'::jsonb,
    '{"forecast": "recent"}'::jsonb
  );

-- armies (world-scoped, no turn_number of its own; needed for army_turn_snapshots)
insert into
  public.armies (
    id,
    world_id,
    nation_id,
    name,
    funding_source,
    stationed_settlement_id,
    created_turn_number
  )
values
  (
    'c7700000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    'Prune Army',
    'nation',
    'c7400000-0000-0000-0000-000000000001',
    0
  );

-- nation_currencies (world-scoped, one row shared by both ledger rows)
insert into
  public.nation_currencies (
    id,
    world_id,
    nation_id,
    name,
    symbol,
    currency_type,
    established_turn_number
  )
values
  (
    'c7700000-0000-0000-0000-000000000002',
    'c7200000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    'Prune Currency',
    'PRC',
    'fiat',
    0
  );

-- citizen (for citizen_memories)
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    status,
    given_name
  )
values
  (
    'c7800000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'c7400000-0000-0000-0000-000000000001',
    'npc',
    'alive',
    'Prunetest'
  );

-- ---------------------------------------------------------------------------
-- Seed: one OLD row (turn 50) and one RECENT row (turn 250) per snapshot- and
-- log-governed append table.
-- ---------------------------------------------------------------------------
insert into
  public.settlement_turn_snapshots (
    id,
    turn_transition_id,
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
    'c7600000-0000-0000-0000-00000000005a',
    'c7200000-0000-0000-0000-000000000001',
    'c7400000-0000-0000-0000-000000000001',
    50,
    100,
    80,
    20,
    150
  ),
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-0000000000fa',
    'c7200000-0000-0000-0000-000000000001',
    'c7400000-0000-0000-0000-000000000001',
    250,
    100,
    80,
    20,
    150
  );

insert into
  public.settlement_turn_resource_snapshots (
    id,
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-00000000005a',
    'c7200000-0000-0000-0000-000000000001',
    'c7400000-0000-0000-0000-000000000001',
    'c7500000-0000-0000-0000-000000000001',
    50,
    100.0,
    150.0
  ),
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-0000000000fa',
    'c7200000-0000-0000-0000-000000000001',
    'c7400000-0000-0000-0000-000000000001',
    'c7500000-0000-0000-0000-000000000001',
    250,
    100.0,
    150.0
  );

insert into
  public.nation_turn_snapshots (
    id,
    turn_transition_id,
    world_id,
    nation_id,
    turn_number
  )
values
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-00000000005a',
    'c7200000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    50
  ),
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-0000000000fa',
    'c7200000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    250
  );

insert into
  public.nation_currency_snapshots (
    id,
    turn_transition_id,
    world_id,
    nation_id,
    currency_id,
    turn_number
  )
values
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-00000000005a',
    'c7200000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    'c7700000-0000-0000-0000-000000000002',
    50
  ),
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-0000000000fa',
    'c7200000-0000-0000-0000-000000000001',
    'c7300000-0000-0000-0000-000000000001',
    'c7700000-0000-0000-0000-000000000002',
    250
  );

insert into
  public.army_turn_snapshots (
    id,
    world_id,
    army_id,
    turn_number,
    soldier_count_total,
    upkeep_paid
  )
values
  (
    gen_random_uuid(),
    'c7200000-0000-0000-0000-000000000001',
    'c7700000-0000-0000-0000-000000000001',
    50,
    10,
    true
  ),
  (
    gen_random_uuid(),
    'c7200000-0000-0000-0000-000000000001',
    'c7700000-0000-0000-0000-000000000001',
    250,
    10,
    true
  );

insert into
  public.turn_log_entries (id, turn_transition_id, world_id, log_category)
values
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-00000000005a',
    'c7200000-0000-0000-0000-000000000001',
    'test_log'
  ),
  (
    gen_random_uuid(),
    'c7600000-0000-0000-0000-0000000000fa',
    'c7200000-0000-0000-0000-000000000001',
    'test_log'
  );

insert into
  public.nation_currency_ledger (id, currency_id, action, amount, turn_number)
values
  (
    gen_random_uuid(),
    'c7700000-0000-0000-0000-000000000002',
    'mint',
    10,
    50
  ),
  (
    gen_random_uuid(),
    'c7700000-0000-0000-0000-000000000002',
    'mint',
    10,
    250
  );

insert into
  public.notifications (
    id,
    recipient_user_id,
    world_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
values
  (
    gen_random_uuid(),
    'c7100000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'turn.completed',
    'Old turn notification',
    'c7600000-0000-0000-0000-00000000005a'
  ),
  (
    gen_random_uuid(),
    'c7100000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'turn.completed',
    'Recent turn notification',
    'c7600000-0000-0000-0000-0000000000fa'
  );

-- Manual notification (no transition) must always be retained regardless of cutoff.
insert into
  public.notifications (
    id,
    recipient_user_id,
    world_id,
    notification_type,
    message_text,
    generated_in_transition_id
  )
values
  (
    gen_random_uuid(),
    'c7100000-0000-0000-0000-000000000001',
    'c7200000-0000-0000-0000-000000000001',
    'turn.completed',
    'Manual notification',
    null
  );

-- citizen_memories: memory_turns is NULL by default (keep-all).
insert into
  public.citizen_memories (
    id,
    world_id,
    citizen_id,
    memory_text,
    occurred_on_turn_number,
    source
  )
values
  (
    gen_random_uuid(),
    'c7200000-0000-0000-0000-000000000001',
    'c7800000-0000-0000-0000-000000000001',
    'Old memory',
    50,
    'manual'
  ),
  (
    gen_random_uuid(),
    'c7200000-0000-0000-0000-000000000001',
    'c7800000-0000-0000-0000-000000000001',
    'Recent memory',
    250,
    'manual'
  );

-- events + event_memories: memories are only prunable once the parent event is
-- terminal (expired/cancelled). Insert event_memories while 'pending' (the
-- freeze trigger allows it), then flip status to 'expired'.
insert into
  public.events (
    id,
    world_id,
    name,
    status,
    activate_on_transition_after_turn_number,
    scope_type
  )
values
  (
    'c7700000-0000-0000-0000-000000000003',
    'c7200000-0000-0000-0000-000000000001',
    'Old Event',
    'pending',
    40,
    'world'
  ),
  (
    'c7700000-0000-0000-0000-000000000004',
    'c7200000-0000-0000-0000-000000000001',
    'Recent Event',
    'pending',
    250,
    'world'
  );

insert into
  public.event_memories (id, event_id, memory_text, turn_offset)
values
  (
    gen_random_uuid(),
    'c7700000-0000-0000-0000-000000000003',
    'Old event memory',
    0
  ),
  (
    gen_random_uuid(),
    'c7700000-0000-0000-0000-000000000004',
    'Recent event memory',
    0
  );

update public.events
set
  status = 'expired'
where
  id in (
    'c7700000-0000-0000-0000-000000000003',
    'c7700000-0000-0000-0000-000000000004'
  );

-- ---------------------------------------------------------------------------
-- Verify setup: 2 rows per table before pruning.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 settlement_turn_snapshots'
  );

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 settlement_turn_resource_snapshots'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 nation_turn_snapshots'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_currency_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 nation_currency_snapshots'
  );

select
  is (
    (
      select
        count(*)
      from
        public.army_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 army_turn_snapshots'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 turn_log_entries'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_currency_ledger
      where
        currency_id = 'c7700000-0000-0000-0000-000000000002'
    ),
    2::bigint,
    'Setup: 2 nation_currency_ledger rows'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    3::bigint,
    'Setup: 3 notifications (old, recent, manual)'
  );

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'Setup: 2 citizen_memories'
  );

select
  is (
    (
      select
        count(*)
      from
        public.event_memories
      where
        event_id in (
          'c7700000-0000-0000-0000-000000000003',
          'c7700000-0000-0000-0000-000000000004'
        )
    ),
    2::bigint,
    'Setup: 2 event_memories'
  );

-- ---------------------------------------------------------------------------
-- Test: first prune call (memory_turns IS NULL -> memory tables untouched)
-- ---------------------------------------------------------------------------
do $$ begin perform public.internal_prune_world_retention('c7200000-0000-0000-0000-000000000001'::uuid, false); end $$;

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 50
    ),
    0::bigint,
    'settlement_turn_snapshots: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 250
    ),
    1::bigint,
    'settlement_turn_snapshots: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 50
    ),
    0::bigint,
    'settlement_turn_resource_snapshots: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.settlement_turn_resource_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 250
    ),
    1::bigint,
    'settlement_turn_resource_snapshots: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 50
    ),
    0::bigint,
    'nation_turn_snapshots: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 250
    ),
    1::bigint,
    'nation_turn_snapshots: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_currency_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 50
    ),
    0::bigint,
    'nation_currency_snapshots: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_currency_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 250
    ),
    1::bigint,
    'nation_currency_snapshots: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.army_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 50
    ),
    0::bigint,
    'army_turn_snapshots: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.army_turn_snapshots
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_number = 250
    ),
    1::bigint,
    'army_turn_snapshots: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_transition_id = 'c7600000-0000-0000-0000-00000000005a'
    ),
    0::bigint,
    'turn_log_entries: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_log_entries
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and turn_transition_id = 'c7600000-0000-0000-0000-0000000000fa'
    ),
    1::bigint,
    'turn_log_entries: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_currency_ledger
      where
        currency_id = 'c7700000-0000-0000-0000-000000000002'
        and turn_number = 50
    ),
    0::bigint,
    'nation_currency_ledger: old row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.nation_currency_ledger
      where
        currency_id = 'c7700000-0000-0000-0000-000000000002'
        and turn_number = 250
    ),
    1::bigint,
    'nation_currency_ledger: recent row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and generated_in_transition_id = 'c7600000-0000-0000-0000-00000000005a'
    ),
    0::bigint,
    'notifications: old transition-linked row pruned'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and generated_in_transition_id = 'c7600000-0000-0000-0000-0000000000fa'
    ),
    1::bigint,
    'notifications: recent transition-linked row kept'
  );

select
  is (
    (
      select
        count(*)
      from
        public.notifications
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and generated_in_transition_id is null
    ),
    1::bigint,
    'notifications: manual (no transition) row retained'
  );

-- Memory tables untouched: both old and recent rows still present.
select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
    ),
    2::bigint,
    'citizen_memories: untouched while memory_turns IS NULL'
  );

select
  is (
    (
      select
        count(*)
      from
        public.event_memories
      where
        event_id in (
          'c7700000-0000-0000-0000-000000000003',
          'c7700000-0000-0000-0000-000000000004'
        )
    ),
    2::bigint,
    'event_memories: untouched while memory_turns IS NULL'
  );

-- turn_transitions width-trim: old row's jsonb columns nulled, row survives;
-- recent row's jsonb columns untouched.
select
  is (
    (
      select
        readiness_summary_jsonb
      from
        public.turn_transitions
      where
        id = 'c7600000-0000-0000-0000-00000000005a'
    ),
    null::jsonb,
    'turn_transitions: old row readiness_summary_jsonb nulled'
  );

select
  is (
    (
      select
        forecast_snapshot_jsonb
      from
        public.turn_transitions
      where
        id = 'c7600000-0000-0000-0000-00000000005a'
    ),
    null::jsonb,
    'turn_transitions: old row forecast_snapshot_jsonb nulled'
  );

select
  is (
    (
      select
        count(*)
      from
        public.turn_transitions
      where
        id = 'c7600000-0000-0000-0000-00000000005a'
    ),
    1::bigint,
    'turn_transitions: old row still exists after trim'
  );

select
  isnt (
    (
      select
        readiness_summary_jsonb
      from
        public.turn_transitions
      where
        id = 'c7600000-0000-0000-0000-0000000000fa'
    ),
    null::jsonb,
    'turn_transitions: recent row readiness_summary_jsonb untouched'
  );

select
  isnt (
    (
      select
        forecast_snapshot_jsonb
      from
        public.turn_transitions
      where
        id = 'c7600000-0000-0000-0000-0000000000fa'
    ),
    null::jsonb,
    'turn_transitions: recent row forecast_snapshot_jsonb untouched'
  );

-- ---------------------------------------------------------------------------
-- Test: idempotency (second call with same config touches nothing further
-- for the already-pruned categories).
-- ---------------------------------------------------------------------------
select
  is (
    (
      (
        internal_prune_world_retention (
          'c7200000-0000-0000-0000-000000000001'::uuid,
          false
        ) ->> 'settlement_turn_snapshots_deleted'
      )::int
    ),
    0::int,
    'Second prune call: no further settlement_turn_snapshots deleted'
  );

-- ---------------------------------------------------------------------------
-- Test: set memory_retention_turns and prune again -> memory tables now pruned.
-- upsert_world_retention_config (Task 1.1) is still a 3-arg RPC (world,
-- log_retention_turns, snapshot_retention_turns) with no memory parameter, so
-- memory_retention_turns is set directly on the config row here.
-- cutoff = 300 - 100 = 200. Old memory rows (turn 50 / activation 40) < 200:
-- pruned. Recent memory rows (turn 250 / activation 250) >= 200: kept.
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $$
    select upsert_world_retention_config(
      'c7200000-0000-0000-0000-000000000001'::uuid,
      200, -- log_retention_turns
      200  -- snapshot_retention_turns
    )
  $$,
    'Superadmin can upsert world_retention_config (log/snapshot turns)'
  );

update public.world_retention_config
set
  memory_retention_turns = 100
where
  world_id = 'c7200000-0000-0000-0000-000000000001';

do $$ begin perform public.internal_prune_world_retention('c7200000-0000-0000-0000-000000000001'::uuid, false); end $$;

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and occurred_on_turn_number = 50
    ),
    0::bigint,
    'citizen_memories: old row pruned once memory_retention_turns is set'
  );

select
  is (
    (
      select
        count(*)
      from
        public.citizen_memories
      where
        world_id = 'c7200000-0000-0000-0000-000000000001'
        and occurred_on_turn_number = 250
    ),
    1::bigint,
    'citizen_memories: recent row kept once memory_retention_turns is set'
  );

select
  is (
    (
      select
        count(*)
      from
        public.event_memories
      where
        event_id = 'c7700000-0000-0000-0000-000000000003'
    ),
    0::bigint,
    'event_memories: old (early-activation, terminal) row pruned once memory_retention_turns is set'
  );

select
  is (
    (
      select
        count(*)
      from
        public.event_memories
      where
        event_id = 'c7700000-0000-0000-0000-000000000004'
    ),
    1::bigint,
    'event_memories: recent (late-activation, terminal) row kept once memory_retention_turns is set'
  );

select
  *
from
  finish ();

rollback;
