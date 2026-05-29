// Settlements feature — manage settlement state within worlds.
// Implemented in Epic 2.
export {
  SetSettlementAutoReadyError,
  SetSettlementReadinessError,
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
} from "./mutations/settlementReadinessMutations";
export {
  settlementReadinessListQueryOptions,
  settlementReadinessSummaryQueryOptions,
} from "./queries/settlementReadinessQueries";
export { SettlementDetailPage } from "./components/SettlementDetailPage";
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
  SettlementMutationError,
  deleteSettlementMutationOptions,
  isSettlementMutationError,
  updateSettlementCoordinatesMutationOptions,
  updateSettlementDetailsMutationOptions,
} from "./mutations/settlementsMutations";
export { settlementByIdQueryOptions } from "./queries/settlementsQueries";
export { settlementsQueryKeys } from "./queries/settlementsQueryKeys";
export {
  createSettlementInputSchema,
  deleteSettlementInputSchema,
  updateSettlementCoordinatesInputSchema,
  updateSettlementDetailsInputSchema,
} from "./schemas/settlementSchemas";
export {
  computeSettlementReadinessSummary,
  formatSettlementReadinessPercentage,
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
export type {
  CreateSettlementInput,
  CreateSettlementValues,
  DeleteSettlementInput,
  DeleteSettlementValues,
  UpdateSettlementCoordinatesInput,
  UpdateSettlementCoordinatesValues,
  UpdateSettlementDetailsInput,
  UpdateSettlementDetailsValues,
} from "./schemas/settlementSchemas";
export type {
  DeleteSettlementResult,
  SettlementMutationIssue,
} from "./mutations/settlementsMutations";
export type {
  Settlement,
  SettlementNationSummary,
  SettlementWithNation,
} from "./types/settlementTypes";
