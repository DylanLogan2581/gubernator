// Managed populations feature — managed population type definitions for world
// configuration. Population instances live in Epic 5; this module covers
// type-level data only.

export { ManagedPopulationsConfigPanel } from "./components/ManagedPopulationsConfigPanel";
export {
  ManagedPopulationTypeMutationError,
  createManagedPopulationTypeMutationOptions,
  hardDeleteManagedPopulationTypeMutationOptions,
  isManagedPopulationTypeMutationError,
  restoreManagedPopulationTypeMutationOptions,
  softDeleteManagedPopulationTypeMutationOptions,
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
  hardDeleteManagedPopulationTypeInputSchema,
  populationResourceEntrySchema,
  restoreManagedPopulationTypeInputSchema,
  softDeleteManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeInputSchema,
} from "./schemas/managedPopulationSchemas";
export { validateManagedPopulationTypeReferencesAgainstWorld } from "./utils/validateManagedPopulationTypeReferences";

export type { ManagedPopulationTypeMutationIssue } from "./mutations/managedPopulationsMutations";
export type {
  CreateManagedPopulationTypeInput,
  CreateManagedPopulationTypeValues,
  HardDeleteManagedPopulationTypeInput,
  HardDeleteManagedPopulationTypeValues,
  PopulationResourceEntryInput,
  PopulationResourceEntryValues,
  RestoreManagedPopulationTypeInput,
  RestoreManagedPopulationTypeValues,
  SoftDeleteManagedPopulationTypeInput,
  SoftDeleteManagedPopulationTypeValues,
  UpdateManagedPopulationTypeInput,
  UpdateManagedPopulationTypeValues,
} from "./schemas/managedPopulationSchemas";
export type {
  HardDeleteManagedPopulationTypeResult,
  ManagedPopulationType,
  PopulationResourceEntry,
  RestoreManagedPopulationTypeResult,
  SoftDeleteManagedPopulationTypeResult,
} from "./types/managedPopulationTypes";
export type { ManagedPopulationTypeReferenceIssue } from "./utils/validateManagedPopulationTypeReferences";
