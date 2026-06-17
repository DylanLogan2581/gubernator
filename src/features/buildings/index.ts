// Buildings feature — building blueprints and settlement buildings.
// Epic 4 (blueprints/tiers) and Epic 5 (settlement buildings, manual deconstruct).

export { BlueprintTierEditor } from "./components/BlueprintTierEditor";
export { BuildingsConfigPanel } from "./components/BuildingsConfigPanel";
export { SettlementBuildingsPanel } from "./components/SettlementBuildingsPanel";
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
  ManualDeconstructBuildingMutationError,
  isManualDeconstructBuildingMutationError,
  manualDeconstructBuildingMutationOptions,
  RestoreSettlementBuildingMutationError,
  isRestoreSettlementBuildingMutationError,
  restoreSettlementBuildingMutationOptions,
  HardDeleteSettlementBuildingMutationError,
  isHardDeleteSettlementBuildingMutationError,
  hardDeleteSettlementBuildingMutationOptions,
} from "./mutations/settlementBuildingsMutations";
export {
  blueprintByIdQueryOptions,
  blueprintsByWorldQueryOptions,
  tierByIdQueryOptions,
  tiersByBlueprintQueryOptions,
} from "./queries/buildingsQueries";
export {
  settlementBuildingByIdQueryOptions,
  settlementBuildingsBySettlementQueryOptions,
  settlementBuildingsByNationsQueryOptions,
  settlementBuildingsByWorldQueryOptions,
  type SettlementBuildingWithLocation,
} from "./queries/settlementBuildingsQueries";
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

export { validateBlueprintTierReferencesAgainstWorld } from "./utils/validateBuildingReferences";

export type { BuildingMutationIssue } from "./mutations/buildingsMutations";

export type { AddSettlementBuildingMutationIssue } from "./mutations/addSettlementBuildingMutations";
export type {
  ManualDeconstructBuildingMutationIssue,
  RestoreSettlementBuildingMutationIssue,
  HardDeleteSettlementBuildingMutationIssue,
} from "./mutations/settlementBuildingsMutations";
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
  AddSettlementBuildingInput,
  AddSettlementBuildingValues,
} from "./schemas/addSettlementBuildingSchemas";
export type {
  ManualDeconstructBuildingInput,
  ManualDeconstructBuildingValues,
  RestoreSettlementBuildingInput,
  RestoreSettlementBuildingValues,
  HardDeleteSettlementBuildingInput,
  HardDeleteSettlementBuildingValues,
} from "./schemas/manualDeconstructBuildingSchemas";
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

export type { BuildingReferenceIssue } from "./utils/validateBuildingReferences";
export type {
  AddSettlementBuildingResult,
  EffectsDigest,
  ManualDeconstructBuildingResult,
  RestoreSettlementBuildingResult,
  HardDeleteSettlementBuildingResult,
  SettlementBuilding,
  SettlementBuildingState,
} from "./types/settlementBuildingTypes";
export { computeEffectsDigest } from "./types/settlementBuildingTypes";
