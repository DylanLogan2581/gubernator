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
export { CreateSettlementDialog } from "./components/CreateSettlementDialog";
export { ManualReadinessControl } from "./components/ManualReadinessControl";
export { SettlementDetailPage } from "./components/SettlementDetailPage";
export {
  SettlementReadinessListPanel,
  SettlementReadinessListPanelContent,
} from "./components/SettlementReadinessListPanel";
export { settlementReadinessQueryKeys } from "./queries/settlementReadinessQueryKeys";
export {
  SettlementMutationError,
  createSettlementMutationOptions,
  deleteSettlementMutationOptions,
  isSettlementMutationError,
  updateSettlementCoordinatesMutationOptions,
  updateSettlementDetailsMutationOptions,
} from "./mutations/settlementsMutations";
export { settlementForecastQueryOptions } from "./queries/settlementForecastQueries";
export { forecastSnapshotSchema } from "./schemas/forecastSchemas";
export type {
  ForecastSnapshot,
  SettlementForecastData,
} from "./schemas/forecastSchemas";
export {
  settlementByIdQueryOptions,
  settlementPopulationCapQueryOptions,
  settlementsByWorldQueryOptions,
} from "./queries/settlementsQueries";
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
  SettlementSummary,
  SettlementWithNation,
} from "./types/settlementTypes";
