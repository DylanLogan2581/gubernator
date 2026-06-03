export { ResourcesConfigPanel } from "./components/ResourcesConfigPanel";
export { SettlementStockpilesPanel } from "./components/SettlementStockpilesPanel";
export {
  ResourceMutationError,
  createResourceMutationOptions,
  hardDeleteResourceMutationOptions,
  isResourceMutationError,
  restoreResourceMutationOptions,
  softDeleteResourceMutationOptions,
  updateResourceMutationOptions,
} from "./mutations/resourcesMutations";
export {
  StockpileMutationError,
  isStockpileMutationError,
  updateSettlementStockpileMutationOptions,
} from "./mutations/settlementStockpilesMutations";
export {
  activeResourcesByWorldQueryOptions,
  resourceByIdQueryOptions,
  resourcesByWorldQueryOptions,
} from "./queries/resourcesQueries";
export { resourcesQueryKeys } from "./queries/resourcesQueryKeys";
export { settlementStockpilesByIdQueryOptions } from "./queries/settlementStockpilesQueries";
export {
  createResourceInputSchema,
  hardDeleteResourceInputSchema,
  restoreResourceInputSchema,
  softDeleteResourceInputSchema,
  updateResourceInputSchema,
} from "./schemas/resourceSchemas";
export { updateSettlementStockpileInputSchema } from "./schemas/settlementStockpileSchemas";

export { validateResourceReferencesAgainstWorld } from "./utils/validateResourceReferences";

export type { ResourceMutationIssue } from "./mutations/resourcesMutations";
export type {
  SettlementStockpileResult,
  StockpileMutationIssue,
} from "./mutations/settlementStockpilesMutations";
export type { ResourceReferenceIssue } from "./utils/validateResourceReferences";
export type {
  CreateResourceInput,
  CreateResourceValues,
  HardDeleteResourceInput,
  HardDeleteResourceValues,
  RestoreResourceInput,
  RestoreResourceValues,
  SoftDeleteResourceInput,
  SoftDeleteResourceValues,
  UpdateResourceInput,
  UpdateResourceValues,
} from "./schemas/resourceSchemas";
export type {
  UpdateSettlementStockpileInput,
  UpdateSettlementStockpileValues,
} from "./schemas/settlementStockpileSchemas";
export type {
  HardDeleteResourceResult,
  Resource,
  ResourceCleanupSummary,
  RestoreResourceResult,
  SoftDeleteResourceResult,
} from "./types/resourceTypes";
export type { SettlementStockpile } from "./queries/settlementStockpilesQueries";
