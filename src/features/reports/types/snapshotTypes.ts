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
