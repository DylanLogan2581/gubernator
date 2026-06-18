export type PopulationSnapshotRow = {
  readonly turn_number: number;
  readonly population_total: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_cap: number;
  readonly birth_count: number;
  readonly death_count: number;
  readonly starvation_deaths_count: number;
  readonly homeless_deaths_count: number;
};

export type ResourceSnapshotRow = {
  readonly turn_number: number;
  readonly resource_id: string;
  readonly resource_name: string;
  readonly quantity_before: number;
  readonly quantity_after: number;
  readonly produced_amount: number;
  readonly consumed_amount: number;
  readonly trade_in_amount: number;
  readonly trade_out_amount: number;
};

// ---------------------------------------------------------------------------
// Nation-level aggregate rows (from nation_turn_population_aggregates /
// nation_turn_resource_aggregates views)
// ---------------------------------------------------------------------------

export type NationPopulationAggregateRow = {
  readonly turn_number: number;
  readonly population_total: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_cap: number;
  readonly birth_count: number;
  readonly death_count: number;
  readonly starvation_deaths_count: number;
  readonly homeless_deaths_count: number;
};

export type NationResourceAggregateRow = {
  readonly turn_number: number;
  readonly resource_id: string;
  readonly resource_name: string;
  readonly produced_amount: number;
  readonly consumed_amount: number;
  readonly trade_in_amount: number;
  readonly trade_out_amount: number;
  readonly net_amount: number;
};

// ---------------------------------------------------------------------------
// World-level aggregate rows (from world_turn_population_aggregates /
// world_turn_resource_aggregates views)
// ---------------------------------------------------------------------------

export type WorldPopulationAggregateRow = {
  readonly turn_number: number;
  readonly population_total: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_cap: number;
  readonly birth_count: number;
  readonly death_count: number;
  readonly starvation_deaths_count: number;
  readonly homeless_deaths_count: number;
};

export type WorldResourceAggregateRow = {
  readonly turn_number: number;
  readonly resource_id: string;
  readonly resource_name: string;
  readonly produced_amount: number;
  readonly consumed_amount: number;
  readonly trade_in_amount: number;
  readonly trade_out_amount: number;
  readonly net_amount: number;
};

// Per-nation row within a world context (nation_turn_population_aggregates
// filtered by world_id — includes nation_id for grouping in the nation
// comparison table on the world overview page)
export type WorldNationPopulationAggregateRow = NationPopulationAggregateRow & {
  readonly nation_id: string;
};

// ---------------------------------------------------------------------------
// Per-settlement-per-nation snapshot row (settlement_turn_snapshots filtered
// by nation, used for the settlement comparison table)
// ---------------------------------------------------------------------------

export type NationSettlementSnapshotRow = {
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly turn_number: number;
  readonly population_total: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_cap: number;
  readonly birth_count: number;
  readonly death_count: number;
  readonly starvation_deaths_count: number;
  readonly homeless_deaths_count: number;
};
