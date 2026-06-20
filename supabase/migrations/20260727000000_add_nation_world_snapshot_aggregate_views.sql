-- Migration: add_nation_world_snapshot_aggregate_views
-- Adds four SECURITY INVOKER views that aggregate settlement_turn_snapshots and
-- settlement_turn_resource_snapshots at query time — no new snapshot tables.
--
-- Views:
--   nation_turn_population_aggregates  — per (world_id, nation_id, turn_number)
--   world_turn_population_aggregates   — per (world_id, turn_number)
--   nation_turn_resource_aggregates    — per (world_id, nation_id, turn_number, resource_id)
--   world_turn_resource_aggregates     — per (world_id, turn_number, resource_id)
--
-- Security: SECURITY INVOKER (default) so the underlying settlement_turn_snapshots
-- and settlement_turn_resource_snapshots RLS policies (current_user_has_world_access)
-- apply at query time. No settlement-level visibility is widened.
-- ---------------------------------------------------------------------------
-- nation_turn_population_aggregates
-- ---------------------------------------------------------------------------
create view public.nation_turn_population_aggregates
with
  (security_invoker = true) as
select
  sts.world_id,
  s.nation_id,
  sts.turn_number,
  sum(sts.population_total)::bigint as population_total,
  sum(sts.population_npc)::bigint as population_npc,
  sum(sts.population_player_character)::bigint as population_player_character,
  sum(sts.population_cap)::bigint as population_cap,
  sum(sts.birth_count)::bigint as birth_count,
  sum(sts.death_count)::bigint as death_count,
  sum(sts.starvation_deaths_count)::bigint as starvation_deaths_count,
  sum(sts.homeless_deaths_count)::bigint as homeless_deaths_count
from
  public.settlement_turn_snapshots sts
  join public.settlements s on s.id = sts.settlement_id
group by
  sts.world_id,
  s.nation_id,
  sts.turn_number;

comment on view public.nation_turn_population_aggregates is 'Per-nation-per-turn population sums aggregated from settlement_turn_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables.';

grant
select
  on public.nation_turn_population_aggregates to authenticated;

-- ---------------------------------------------------------------------------
-- world_turn_population_aggregates
-- ---------------------------------------------------------------------------
create view public.world_turn_population_aggregates
with
  (security_invoker = true) as
select
  sts.world_id,
  sts.turn_number,
  sum(sts.population_total)::bigint as population_total,
  sum(sts.population_npc)::bigint as population_npc,
  sum(sts.population_player_character)::bigint as population_player_character,
  sum(sts.population_cap)::bigint as population_cap,
  sum(sts.birth_count)::bigint as birth_count,
  sum(sts.death_count)::bigint as death_count,
  sum(sts.starvation_deaths_count)::bigint as starvation_deaths_count,
  sum(sts.homeless_deaths_count)::bigint as homeless_deaths_count
from
  public.settlement_turn_snapshots sts
group by
  sts.world_id,
  sts.turn_number;

comment on view public.world_turn_population_aggregates is 'Per-world-per-turn population sums aggregated from settlement_turn_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables.';

grant
select
  on public.world_turn_population_aggregates to authenticated;

-- ---------------------------------------------------------------------------
-- nation_turn_resource_aggregates
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
  sum(
    sts.produced_amount - sts.consumed_amount + sts.trade_in_amount - sts.trade_out_amount
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

comment on view public.nation_turn_resource_aggregates is 'Per-nation-per-turn-per-resource sums aggregated from settlement_turn_resource_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables.';

grant
select
  on public.nation_turn_resource_aggregates to authenticated;

-- ---------------------------------------------------------------------------
-- world_turn_resource_aggregates
-- ---------------------------------------------------------------------------
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
  sum(
    sts.produced_amount - sts.consumed_amount + sts.trade_in_amount - sts.trade_out_amount
  ) as net_amount
from
  public.settlement_turn_resource_snapshots sts
  join public.resources r on r.id = sts.resource_id
group by
  sts.world_id,
  sts.turn_number,
  sts.resource_id,
  r.name;

comment on view public.world_turn_resource_aggregates is 'Per-world-per-turn-per-resource sums aggregated from settlement_turn_resource_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables.';

grant
select
  on public.world_turn_resource_aggregates to authenticated;
