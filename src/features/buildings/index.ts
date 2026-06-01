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
  blueprintByIdQueryOptions,
  blueprintsByWorldQueryOptions,
  tierByIdQueryOptions,
  tiersByBlueprintQueryOptions,
} from "./queries/buildingsQueries";
export { constructionProjectsBySettlementQueryOptions } from "./queries/constructionProjectsQueries";
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
export { validateBlueprintTierReferencesAgainstWorld } from "./utils/validateBuildingReferences";

export type { BuildingMutationIssue } from "./mutations/buildingsMutations";
export type { CancelConstructionProjectMutationIssue } from "./mutations/cancelConstructionProjectMutations";
export type { ConstructionProjectMutationIssue } from "./mutations/createConstructionProjectMutations";
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
} from "./types/constructionProjectTypes";
export type { BuildingReferenceIssue } from "./utils/validateBuildingReferences";
