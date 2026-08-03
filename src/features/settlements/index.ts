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
export { ForecastPanel } from "./components/ForecastPanel";
export { ForecastResourceSparkline } from "./components/ForecastResourceSparkline";
export { ManualReadinessControl } from "./components/ManualReadinessControl";
export { ReadOnlyReadinessIndicator } from "./components/ReadinessStateBadge";
export { SettlementCoordinatesSection } from "./components/SettlementDetailPage/CoordinatesSection";
export { SettlementDeleteSection } from "./components/SettlementDetailPage/DeleteSection";
export { SettlementDemographicsCard } from "./components/SettlementDetailPage/SettlementDemographicsCard";
export { SettlementDetailsSection } from "./components/SettlementDetailPage/DetailsSection";
export { SettlementDetailPage } from "./components/SettlementDetailPage";
export { SettlementImagerySection } from "./components/SettlementDetailPage/ImagerySection";
export { SettlementFlagAvatar } from "./components/SettlementFlagAvatar";
export { SettlementSealAvatar } from "./components/SettlementSealAvatar";
export { SettlementForecastWarningsCard } from "./components/SettlementDetailPage/ForecastWarningsCard";
export { GarrisonCard } from "./components/SettlementDetailPage/GarrisonCard";
export { SettlementManagerCard } from "./components/SettlementDetailPage/ManagerCard";
export { SettlementOfficesSection } from "./components/SettlementDetailPage/OfficesSection";
export { SettlementOverviewStatTiles } from "./components/SettlementOverviewStatTiles";
export { useSettlementDetailContext } from "./components/SettlementDetailPage/SettlementDetailContext";
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
export {
  removeSettlementFlagMutationOptions,
  removeSettlementSealMutationOptions,
  settlementFlagPath,
  settlementSealPath,
  uploadSettlementFlagMutationOptions,
  uploadSettlementSealMutationOptions,
} from "./mutations/settlementImageMutations";
export { useSettlementImageSignedUrl } from "./queries/settlementImageQueries";
export { settlementForecastQueryOptions } from "./queries/settlementForecastQueries";
export { settlementForecastQueryKeys } from "./queries/settlementForecastQueryKeys";
export { forecastSnapshotSchema } from "./schemas/forecastSchemas";
export type {
  ForecastSnapshot,
  SettlementForecastData,
} from "./schemas/forecastSchemas";
export type { ForecastSparklinePoint } from "./components/ForecastResourceSparkline";
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
