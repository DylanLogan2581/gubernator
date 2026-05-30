// Buildings feature — define building blueprints and their tier costs/effects for worlds.
// Implemented in Epic 4.

export {
  BuildingMutationError,
  createBlueprintMutationOptions,
  createTierMutationOptions,
  deleteTierMutationOptions,
  isBuildingMutationError,
  setBlueprintActiveMutationOptions,
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
  setBlueprintActiveInputSchema,
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
  SetBlueprintActiveInput,
  SetBlueprintActiveValues,
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
  SetBlueprintActiveResult,
  TierCostEntry,
  TierEffect,
} from "./types/buildingTypes";
export type { BuildingReferenceIssue } from "./utils/validateBuildingReferences";
