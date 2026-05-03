// Settlements feature — manage settlement state within worlds.
// Implemented in Epic 2.
export {
  SetSettlementAutoReadyError,
  SetSettlementReadinessError,
  isSetSettlementAutoReadyError,
  isSetSettlementReadinessError,
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
} from "./mutations/settlementReadinessMutations";
export {
  settlementReadinessListQueryOptions,
  settlementReadinessSummaryQueryOptions,
} from "./queries/settlementReadinessQueries";
export {
  SettlementReadinessListPanel,
  SettlementReadinessListPanelContent,
} from "./components/SettlementReadinessListPanel";
export {
  SettlementReadinessSummaryPanel,
  SettlementReadinessSummaryPanelContent,
} from "./components/SettlementReadinessSummaryPanel";
export { settlementReadinessQueryKeys } from "./queries/settlementReadinessQueryKeys";
export {
  computeSettlementReadinessSummary,
  isSettlementReadyForCurrentTurn,
} from "./utils/settlementReadinessSummary";
export {
  createSettlementReadinessResetUpdate,
  createSettlementReadinessResetUpdatePayload,
  createSettlementReadinessResetUpdates,
} from "./utils/settlementReadinessReset";

export type {
  SetSettlementAutoReadyInput,
  SetSettlementReadinessInput,
  SettlementAutoReadyMutationResult,
  SettlementReadinessMutationResult,
} from "./mutations/settlementReadinessMutations";
export type {
  SettlementReadinessListItem,
  SettlementReadinessSummary,
} from "./types/settlementReadinessTypes";
export type { SettlementReadinessSummaryRow } from "./utils/settlementReadinessSummary";
export type {
  SettlementReadinessResetRow,
  SettlementReadinessResetUpdate,
  SettlementReadinessResetUpdatePayload,
} from "./utils/settlementReadinessReset";
