// Reports feature — settlement turn snapshot visualizations (Epic 8).
export { SettlementReportsPanel } from "./components/SettlementReportsPanel";
export { CompositionDonutChart } from "./components/SettlementReportsPanel/CompositionDonutChart";
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
export {
  createTurnLabelers,
  defaultReportTurnRange,
  type TurnLabelers,
} from "./utils/reportTurnRange";
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
export type { DonutSlice } from "./components/SettlementReportsPanel/CompositionDonutChart";
