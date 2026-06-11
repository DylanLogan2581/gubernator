-- Migration: backfill_baseline_turn_snapshots
-- Seeds one settlement_turn_snapshots baseline row (turn_transition_id = NULL)
-- and one settlement_turn_resource_snapshots baseline row per
-- (settlement, resource) pair for every existing settlement so the first real
-- Epic 6 turn transition has a quantity_before to anchor against.
--
-- Idempotent: the WHERE NOT EXISTS guards skip any settlement / pair that
-- already has a baseline row. NULL turn_transition_id makes the unique
-- constraint on settlement_turn_resource_snapshots non-applicable (NULL ≠ NULL
-- in standard unique indexes), so ON CONFLICT cannot be used for
-- deduplication here.
-- ---------------------------------------------------------------------------
-- Baseline settlement_turn_snapshots: one row per settlement
-- ---------------------------------------------------------------------------
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
    homeless_deaths_count,
    partnerships_formed_count
  )
select
  null as turn_transition_id,
  n.world_id,
  s.id as settlement_id,
  w.current_turn_number as turn_number,
  (
    select
      count(*)::integer
    from
      public.citizens c
    where
      c.settlement_id = s.id
      and c.status = 'alive'
  ) as population_total,
  (
    select
      count(*)::integer
    from
      public.citizens c
    where
      c.settlement_id = s.id
      and c.status = 'alive'
      and c.citizen_type = 'npc'
  ) as population_npc,
  (
    select
      count(*)::integer
    from
      public.citizens c
    where
      c.settlement_id = s.id
      and c.status = 'alive'
      and c.citizen_type = 'player_character'
  ) as population_player_character,
  public.settlement_population_cap (s.id)::integer as population_cap,
  0,
  0,
  0,
  0,
  0
from
  public.settlements s
  join public.nations n on n.id = s.nation_id
  join public.worlds w on w.id = n.world_id
where
  not exists (
    select
      1
    from
      public.settlement_turn_snapshots sts
    where
      sts.settlement_id = s.id
      and sts.turn_number = w.current_turn_number
      and sts.turn_transition_id is null
  );

-- ---------------------------------------------------------------------------
-- Baseline settlement_turn_resource_snapshots: one row per (settlement, resource)
-- ---------------------------------------------------------------------------
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
    trade_out_amount
  )
select
  null as turn_transition_id,
  n.world_id,
  s.id as settlement_id,
  srs.resource_id,
  w.current_turn_number as turn_number,
  srs.quantity as quantity_before,
  srs.quantity as quantity_after,
  0,
  0,
  0,
  0
from
  public.settlements s
  join public.nations n on n.id = s.nation_id
  join public.worlds w on w.id = n.world_id
  join public.settlement_resource_stockpiles srs on srs.settlement_id = s.id
where
  not exists (
    select
      1
    from
      public.settlement_turn_resource_snapshots strs
    where
      strs.settlement_id = s.id
      and strs.resource_id = srs.resource_id
      and strs.turn_number = w.current_turn_number
      and strs.turn_transition_id is null
  );
