
-- ---------------------------------------------------------------------------
-- Baseline turn snapshots (turn_transition_id IS NULL) — one per settlement and
-- one per (settlement, resource) stockpile pair, anchored at the world's
-- current turn. The migration backfill (20260602000010) runs before this seed
-- creates any settlements, so it is re-run here against the loaded world. The
-- NOT EXISTS guards keep it idempotent.
-- ---------------------------------------------------------------------------
insert into public.settlement_turn_snapshots (
  turn_transition_id, world_id, settlement_id, turn_number,
  population_total, population_npc, population_player_character, population_cap,
  birth_count, death_count, starvation_deaths_count, homeless_deaths_count, partnerships_formed_count
)
select
  null, n.world_id, s.id, w.current_turn_number,
  (select count(*)::integer from public.citizens c where c.settlement_id = s.id and c.status = 'alive'),
  (select count(*)::integer from public.citizens c where c.settlement_id = s.id and c.status = 'alive' and c.citizen_type = 'npc'),
  (select count(*)::integer from public.citizens c where c.settlement_id = s.id and c.status = 'alive' and c.citizen_type = 'player_character'),
  public.settlement_population_cap (s.id)::integer,
  0, 0, 0, 0, 0
from public.settlements s
  join public.nations n on n.id = s.nation_id
  join public.worlds w on w.id = n.world_id
where not exists (
  select 1 from public.settlement_turn_snapshots sts
  where sts.settlement_id = s.id and sts.turn_number = w.current_turn_number and sts.turn_transition_id is null
);

insert into public.settlement_turn_resource_snapshots (
  turn_transition_id, world_id, settlement_id, resource_id, turn_number,
  quantity_before, quantity_after, produced_amount, consumed_amount, trade_in_amount, trade_out_amount
)
select
  null, n.world_id, s.id, srs.resource_id, w.current_turn_number,
  srs.quantity, srs.quantity, 0, 0, 0, 0
from public.settlements s
  join public.nations n on n.id = s.nation_id
  join public.worlds w on w.id = n.world_id
  join public.settlement_resource_stockpiles srs on srs.settlement_id = s.id
where not exists (
  select 1 from public.settlement_turn_resource_snapshots strs
  where strs.settlement_id = s.id and strs.resource_id = srs.resource_id
    and strs.turn_number = w.current_turn_number and strs.turn_transition_id is null
);
