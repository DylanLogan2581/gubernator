// Buildings feature — building blueprints, settlement buildings, and construction.
// Epic 4 (blueprints/tiers) and Epic 5 (settlement buildings, manual deconstruct).

export { BlueprintTierEditor } from "./components/BlueprintTierEditor";
export { BuildingsConfigPanel } from "./components/BuildingsConfigPanel";
export { SettlementBuildingsPanel } from "./components/SettlementBuildingsPanel";
export { SettlementConstructionPanel } from "./components/SettlementConstructionPanel";
export { CostEditor, EffectsEditor } from "./components/TierEditorFields";
export {
  buildCostInputs,
  buildEffectInputs,
  extractFieldErrors,
  extractRefErrors,
  tierCostsToState,
  tierEffectsToState,
} from "./utils/tierEditorUtils";
export type {
  CostRowState,
  EffectRowState,
  TierFormErrors,
} from "./utils/tierEditorUtils";
export {
  AddSettlementBuildingMutationError,
  addSettlementBuildingMutationOptions,
  isAddSettlementBuildingMutationError,
} from "./mutations/addSettlementBuildingMutations";
export {
  BuildingMutationError,
  createBlueprintMutationOptions,
  createTierMutationOptions,
  deleteTierMutationOptions,
  hardDeleteBlueprintMutationOptions,
  isBuildingMutationError,
  restoreBlueprintMutationOptions,
  softDeleteBlueprintMutationOptions,
  updateBlueprintMutationOptions,
  updateTierMutationOptions,
} from "./mutations/buildingsMutations";
export {
  CancelConstructionProjectMutationError,
  cancelConstructionProjectMutationOptions,
  isCancelConstructionProjectMutationError,
} from "./mutations/cancelConstructionProjectMutations";
export {
  ConstructionProjectMutationError,
  createConstructionProjectMutationOptions,
  isConstructionProjectMutationError,
} from "./mutations/createConstructionProjectMutations";
export {
  ReorderConstructionProjectsMutationError,
  isReorderConstructionProjectsMutationError,
  reorderConstructionProjectsMutationOptions,
} from "./mutations/reorderConstructionProjectsMutations";
export {
  ManualDeconstructBuildingMutationError,
  isManualDeconstructBuildingMutationError,
  manualDeconstructBuildingMutationOptions,
} from "./mutations/settlementBuildingsMutations";
export {
  SetConstructionProjectWorkersMutationError,
  isSetConstructionProjectWorkersMutationError,
  setConstructionProjectWorkersMutationOptions,
} from "./mutations/setConstructionProjectWorkersMutations";
export {
  blueprintByIdQueryOptions,
  blueprintsByWorldQueryOptions,
  tierByIdQueryOptions,
  tiersByBlueprintQueryOptions,
} from "./queries/buildingsQueries";
export { constructionProjectsBySettlementQueryOptions } from "./queries/constructionProjectsQueries";
export { settlementBuildingsBySettlementQueryOptions } from "./queries/settlementBuildingsQueries";
export { settlementPopulationCapQueryOptions } from "./queries/settlementPopulationCapQueries";
export { buildingsQueryKeys } from "./queries/buildingsQueryKeys";
export {
  createBlueprintInputSchema,
  createTierInputSchema,
  deleteTierInputSchema,
  hardDeleteBlueprintInputSchema,
  restoreBlueprintInputSchema,
  softDeleteBlueprintInputSchema,
  tierCostEntrySchema,
  tierEffectSchema,
  updateBlueprintInputSchema,
  updateTierInputSchema,
} from "./schemas/buildingSchemas";
export { cancelConstructionProjectInputSchema } from "./schemas/cancelConstructionProjectSchemas";
export { createConstructionProjectInputSchema } from "./schemas/createConstructionProjectSchemas";
export { reorderConstructionProjectsInputSchema } from "./schemas/reorderConstructionProjectsSchemas";
export { addSettlementBuildingInputSchema } from "./schemas/addSettlementBuildingSchemas";
export { manualDeconstructBuildingInputSchema } from "./schemas/manualDeconstructBuildingSchemas";
export { setConstructionProjectWorkersInputSchema } from "./schemas/setConstructionProjectWorkersSchemas";
export { validateBlueprintTierReferencesAgainstWorld } from "./utils/validateBuildingReferences";

export type { BuildingMutationIssue } from "./mutations/buildingsMutations";
export type { CancelConstructionProjectMutationIssue } from "./mutations/cancelConstructionProjectMutations";
export type { ConstructionProjectMutationIssue } from "./mutations/createConstructionProjectMutations";
export type { ReorderConstructionProjectsMutationIssue } from "./mutations/reorderConstructionProjectsMutations";
export type { AddSettlementBuildingMutationIssue } from "./mutations/addSettlementBuildingMutations";
export type { ManualDeconstructBuildingMutationIssue } from "./mutations/settlementBuildingsMutations";
export type { SetConstructionProjectWorkersMutationIssue } from "./mutations/setConstructionProjectWorkersMutations";
export type {
  CreateBlueprintInput,
  CreateBlueprintValues,
  CreateTierInput,
  CreateTierValues,
  DeleteTierInput,
  DeleteTierValues,
  HardDeleteBlueprintInput,
  HardDeleteBlueprintValues,
  RestoreBlueprintInput,
  RestoreBlueprintValues,
  SoftDeleteBlueprintInput,
  SoftDeleteBlueprintValues,
  TierCostEntryInput,
  TierCostEntryValues,
  TierEffectInput,
  TierEffectValues,
  UpdateBlueprintInput,
  UpdateBlueprintValues,
  UpdateTierInput,
  UpdateTierValues,
} from "./schemas/buildingSchemas";
export type {
  CancelConstructionProjectInput,
  CancelConstructionProjectValues,
} from "./schemas/cancelConstructionProjectSchemas";
export type {
  CreateConstructionProjectInput,
  CreateConstructionProjectValues,
} from "./schemas/createConstructionProjectSchemas";
export type {
  PositionEntry,
  ReorderConstructionProjectsInput,
  ReorderConstructionProjectsValues,
} from "./schemas/reorderConstructionProjectsSchemas";
export type {
  AddSettlementBuildingInput,
  AddSettlementBuildingValues,
} from "./schemas/addSettlementBuildingSchemas";
export type {
  ManualDeconstructBuildingInput,
  ManualDeconstructBuildingValues,
} from "./schemas/manualDeconstructBuildingSchemas";
export type {
  SetConstructionProjectWorkersInput,
  SetConstructionProjectWorkersValues,
} from "./schemas/setConstructionProjectWorkersSchemas";
export type {
  BuildingBlueprint,
  BuildingBlueprintTier,
  DeleteTierResult,
  EffectTypeName,
  HardDeleteBlueprintResult,
  RestoreBlueprintResult,
  SoftDeleteBlueprintResult,
  TierCostEntry,
  TierEffect,
} from "./types/buildingTypes";
export type {
  CancelConstructionProjectResult,
  ConstructionProject,
  ConstructionProjectStatus,
  CreateConstructionProjectResult,
  ReorderConstructionProjectsResult,
  SetConstructionProjectWorkersResult,
} from "./types/constructionProjectTypes";
export type { BuildingReferenceIssue } from "./utils/validateBuildingReferences";
export type {
  AddSettlementBuildingResult,
  EffectsDigest,
  ManualDeconstructBuildingResult,
  SettlementBuilding,
  SettlementBuildingState,
} from "./types/settlementBuildingTypes";
export { computeEffectsDigest } from "./types/settlementBuildingTypes";
