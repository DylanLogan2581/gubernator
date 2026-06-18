// Reports feature — settlement turn snapshot visualizations (Epic 8).
export { SettlementReportsPanel } from "./components/SettlementReportsPanel";
export { PopulationTrendChart } from "./components/SettlementReportsPanel/PopulationTrendChart";
export { TurnRangeSelector } from "./components/SettlementReportsPanel/TurnRangeSelector";
export {
  settlementPopulationSnapshotsQueryOptions,
  settlementResourceSnapshotsQueryOptions,
} from "./queries/settlementSnapshotQueries";
export { settlementSnapshotQueryKeys } from "./queries/settlementSnapshotQueryKeys";
export {
  nationPopulationAggregatesQueryOptions,
  nationResourceAggregatesQueryOptions,
  nationSettlementSnapshotsQueryOptions,
  worldNationsPopulationQueryOptions,
  worldPopulationAggregatesQueryOptions,
  worldResourceAggregatesQueryOptions,
} from "./queries/snapshotAggregateQueries";
export { snapshotAggregateQueryKeys } from "./queries/snapshotAggregateQueryKeys";
export type {
  NationPopulationAggregateRow,
  NationResourceAggregateRow,
  NationSettlementSnapshotRow,
  PopulationSnapshotRow,
  ResourceSnapshotRow,
  WorldNationPopulationAggregateRow,
  WorldPopulationAggregateRow,
  WorldResourceAggregateRow,
} from "./types/snapshotTypes";
