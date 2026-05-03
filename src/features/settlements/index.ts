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
export { settlementReadinessQueryKeys } from "./queries/settlementReadinessQueryKeys";
export {
  computeSettlementReadinessSummary,
  isSettlementReadyForCurrentTurn,
} from "./utils/settlementReadinessSummary";

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
