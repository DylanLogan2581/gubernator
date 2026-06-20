-- pgTAP tests for nation_turn_population_aggregates, world_turn_population_aggregates,
-- nation_turn_resource_aggregates, and world_turn_resource_aggregates views (issue #788).
--
-- Acceptance criteria:
--   AC1: nation aggregate for a fixture turn equals the sum of its settlement snapshot rows.
--   AC2: world aggregate for a fixture turn equals the sum of all settlement snapshot rows.
--   AC3: settlement-level visibility rules not widened — outsider cannot see aggregates
--        for a world they cannot access (pgTAP negative case).
--
-- UUID prefix map (all hex, unique to this file):
--   fa100000 = users          fa200000 = worlds
--   fa300000 = nations        fa400000 = settlements
--   fa500000 = resources      fa600000 = turn transitions
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures (running as postgres / superuser — bypasses RLS)
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
    'fa100000-0000-0000-0000-000000000001',
    'nwsav-owner@example.com',
    'x',
    now(),
    '{"username":"nwsav_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'fa100000-0000-0000-0000-000000000002',
    'nwsav-outsider@example.com',
    'x',
    now(),
    '{"username":"nwsav_outsider"}'::jsonb,
    now(),
    now()
  );

-- World with owner
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'fa200000-0000-0000-0000-000000000001',
    'NWSAV Aggregate World',
    5,
    'private',
    'active'
  ),
  (
    'fa200000-0000-0000-0000-000000000002',
    'NWSAV Outsider Separate World',
    1,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'fa200000-0000-0000-0000-000000000001',
    'fa100000-0000-0000-0000-000000000001'
  );

-- One nation, two settlements
insert into
  public.nations (id, world_id, name)
values
  (
    'fa300000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    'NWSAV Nation A'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'fa400000-0000-0000-0000-000000000001',
    'fa300000-0000-0000-0000-000000000001',
    'NWSAV Settlement Alpha'
  ),
  (
    'fa400000-0000-0000-0000-000000000002',
    'fa300000-0000-0000-0000-000000000001',
    'NWSAV Settlement Beta'
  );

-- One resource in the world
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'fa500000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    'NWSAV Grain',
    'nwsav-grain',
    1000
  );

-- Turn transition
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    finished_at
  )
values
  (
    'fa600000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    4,
    5,
    'fa100000-0000-0000-0000-000000000001',
    'completed',
    now()
  );

-- Population snapshots: two settlements at turn 5
-- Settlement Alpha: 80 total / 75 npc / 5 pc / 120 cap / 3 births / 1 death (0 starv / 1 homeless)
-- Settlement Beta:  50 total / 50 npc / 0 pc /  80 cap / 1 birth  / 2 deaths (1 starv / 1 homeless)
-- Expected nation totals: 130 total / 125 npc / 5 pc / 200 cap / 4 births / 3 deaths (1 starv / 2 homeless)
-- Expected world totals:  same (only one nation)
insert into
  public.settlement_turn_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    turn_number,
    population_total,
    population_npc,
    population_player_character,
    population_cap,
    birth_count,
    death_count,
    starvation_deaths_count,
    homeless_deaths_count
  )
values
  (
    'fa600000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    'fa400000-0000-0000-0000-000000000001',
    5,
    80,
    75,
    5,
    120,
    3,
    1,
    0,
    1
  ),
  (
    'fa600000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    'fa400000-0000-0000-0000-000000000002',
    5,
    50,
    50,
    0,
    80,
    1,
    2,
    1,
    1
  );

-- Resource snapshots: two settlements × one resource at turn 5
-- Settlement Alpha: produced 40 / consumed 10 / trade_in 5 / trade_out 3  => net 32
-- Settlement Beta:  produced 20 / consumed 15 / trade_in 2 / trade_out 0  => net  7
-- Expected nation totals: produced 60 / consumed 25 / trade_in 7 / trade_out 3 / net 39
-- Expected world totals:  same (only one nation)
insert into
  public.settlement_turn_resource_snapshots (
    turn_transition_id,
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    produced_amount,
    consumed_amount,
    trade_in_amount,
    trade_out_amount
  )
values
  (
    'fa600000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    'fa400000-0000-0000-0000-000000000001',
    'fa500000-0000-0000-0000-000000000001',
    5,
    40,
    10,
    5,
    3
  ),
  (
    'fa600000-0000-0000-0000-000000000001',
    'fa200000-0000-0000-0000-000000000001',
    'fa400000-0000-0000-0000-000000000002',
    'fa500000-0000-0000-0000-000000000001',
    5,
    20,
    15,
    2,
    0
  );

-- ---------------------------------------------------------------------------
-- AC1a: nation population aggregate — population_total equals sum of settlements
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (
          n.population_total,
          n.population_npc,
          n.population_player_character,
          n.birth_count,
          n.death_count,
          n.starvation_deaths_count,
          n.homeless_deaths_count
        )
      from
        public.nation_turn_population_aggregates n
      where
        n.world_id = 'fa200000-0000-0000-0000-000000000001'
        and n.nation_id = 'fa300000-0000-0000-0000-000000000001'
        and n.turn_number = 5
    ),
    row (
      130::bigint,
      125::bigint,
      5::bigint,
      4::bigint,
      3::bigint,
      1::bigint,
      2::bigint
    ),
    'nation population aggregate equals sum of its two settlement snapshot rows'
  );

-- ---------------------------------------------------------------------------
-- AC1b: world population aggregate — equals sum of all settlements in world
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (
          w.population_total,
          w.population_npc,
          w.population_player_character,
          w.birth_count,
          w.death_count,
          w.starvation_deaths_count,
          w.homeless_deaths_count
        )
      from
        public.world_turn_population_aggregates w
      where
        w.world_id = 'fa200000-0000-0000-0000-000000000001'
        and w.turn_number = 5
    ),
    row (
      130::bigint,
      125::bigint,
      5::bigint,
      4::bigint,
      3::bigint,
      1::bigint,
      2::bigint
    ),
    'world population aggregate equals sum of all settlement snapshot rows in the world'
  );

-- ---------------------------------------------------------------------------
-- AC1c: verify by direct comparison to settlement row sums (not hard-coded)
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        n.population_total
      from
        public.nation_turn_population_aggregates n
      where
        n.world_id = 'fa200000-0000-0000-0000-000000000001'
        and n.nation_id = 'fa300000-0000-0000-0000-000000000001'
        and n.turn_number = 5
    ),
    (
      select
        sum(sts.population_total)::bigint
      from
        public.settlement_turn_snapshots sts
        join public.settlements s on s.id = sts.settlement_id
      where
        sts.world_id = 'fa200000-0000-0000-0000-000000000001'
        and s.nation_id = 'fa300000-0000-0000-0000-000000000001'
        and sts.turn_number = 5
    ),
    'nation population_total from view equals direct SUM from settlement_turn_snapshots'
  );

-- ---------------------------------------------------------------------------
-- AC2a: nation resource aggregate — produced/consumed/net equals sum of settlements
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (
          n.produced_amount,
          n.consumed_amount,
          n.trade_in_amount,
          n.trade_out_amount,
          n.net_amount
        )
      from
        public.nation_turn_resource_aggregates n
      where
        n.world_id = 'fa200000-0000-0000-0000-000000000001'
        and n.nation_id = 'fa300000-0000-0000-0000-000000000001'
        and n.resource_id = 'fa500000-0000-0000-0000-000000000001'
        and n.turn_number = 5
    ),
    row (
      60::numeric,
      25::numeric,
      7::numeric,
      3::numeric,
      39::numeric
    ),
    'nation resource aggregate equals sum of its two settlement resource snapshot rows'
  );

-- ---------------------------------------------------------------------------
-- AC2b: world resource aggregate — equals sum of all settlements
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        row (
          w.produced_amount,
          w.consumed_amount,
          w.trade_in_amount,
          w.trade_out_amount,
          w.net_amount
        )
      from
        public.world_turn_resource_aggregates w
      where
        w.world_id = 'fa200000-0000-0000-0000-000000000001'
        and w.resource_id = 'fa500000-0000-0000-0000-000000000001'
        and w.turn_number = 5
    ),
    row (
      60::numeric,
      25::numeric,
      7::numeric,
      3::numeric,
      39::numeric
    ),
    'world resource aggregate equals sum of all settlement resource snapshot rows'
  );

-- ---------------------------------------------------------------------------
-- AC3: negative RLS — outsider cannot see aggregates for an inaccessible world
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fa100000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_turn_population_aggregates
      where
        world_id = 'fa200000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read nation_turn_population_aggregates for a world they cannot access'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.world_turn_population_aggregates
      where
        world_id = 'fa200000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read world_turn_population_aggregates for a world they cannot access'
  );

reset role;

select
  *
from
  finish ();

rollback;
