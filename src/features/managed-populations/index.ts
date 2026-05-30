// Managed populations feature — managed population type definitions for world
// configuration. Population instances live in Epic 5; this module covers
// type-level data only.

export {
  ManagedPopulationTypeMutationError,
  createManagedPopulationTypeMutationOptions,
  isManagedPopulationTypeMutationError,
  setManagedPopulationTypeActiveMutationOptions,
  updateManagedPopulationTypeMutationOptions,
} from "./mutations/managedPopulationsMutations";
export {
  activeManagedPopulationTypesByWorldQueryOptions,
  managedPopulationTypeByIdQueryOptions,
  managedPopulationTypesByWorldQueryOptions,
} from "./queries/managedPopulationsQueries";
export { managedPopulationsQueryKeys } from "./queries/managedPopulationsQueryKeys";
export {
  createManagedPopulationTypeInputSchema,
  populationResourceEntrySchema,
  setManagedPopulationTypeActiveInputSchema,
  updateManagedPopulationTypeInputSchema,
} from "./schemas/managedPopulationSchemas";
export { validateManagedPopulationTypeReferencesAgainstWorld } from "./utils/validateManagedPopulationTypeReferences";

export type { ManagedPopulationTypeMutationIssue } from "./mutations/managedPopulationsMutations";
export type {
  CreateManagedPopulationTypeInput,
  CreateManagedPopulationTypeValues,
  PopulationResourceEntryInput,
  PopulationResourceEntryValues,
  SetManagedPopulationTypeActiveInput,
  SetManagedPopulationTypeActiveValues,
  UpdateManagedPopulationTypeInput,
  UpdateManagedPopulationTypeValues,
} from "./schemas/managedPopulationSchemas";
export type {
  ManagedPopulationType,
  PopulationResourceEntry,
  SetManagedPopulationTypeActiveResult,
} from "./types/managedPopulationTypes";
export type { ManagedPopulationTypeReferenceIssue } from "./utils/validateManagedPopulationTypeReferences";
