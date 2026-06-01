// Buildings feature — define building blueprints and their tier costs/effects for worlds.
// Implemented in Epic 4.

export { BlueprintTierEditor } from "./components/BlueprintTierEditor";
export { BuildingsConfigPanel } from "./components/BuildingsConfigPanel";
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
  blueprintByIdQueryOptions,
  blueprintsByWorldQueryOptions,
  tierByIdQueryOptions,
  tiersByBlueprintQueryOptions,
} from "./queries/buildingsQueries";
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
