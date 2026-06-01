// Managed populations feature — managed population type definitions for world
// configuration and population instances for per-settlement management (Epic 5).

export { ManagedPopulationsConfigPanel } from "./components/ManagedPopulationsConfigPanel";
export {
  CreateManagedPopulationInstanceMutationError,
  createManagedPopulationInstanceMutationOptions,
  isCreateManagedPopulationInstanceMutationError,
} from "./mutations/createManagedPopulationInstanceMutations";
export {
  SetConfiguredCullQuantityMutationError,
  isSetConfiguredCullQuantityMutationError,
  setConfiguredCullQuantityMutationOptions,
} from "./mutations/setConfiguredCullQuantityMutations";
export {
  ManagedPopulationTypeMutationError,
  createManagedPopulationTypeMutationOptions,
  hardDeleteManagedPopulationTypeMutationOptions,
  isManagedPopulationTypeMutationError,
  restoreManagedPopulationTypeMutationOptions,
  softDeleteManagedPopulationTypeMutationOptions,
  updateManagedPopulationTypeMutationOptions,
} from "./mutations/managedPopulationsMutations";
export { managedPopulationInstancesBySettlementQueryOptions } from "./queries/managedPopulationInstancesQueries";
export {
  activeManagedPopulationTypesByWorldQueryOptions,
  managedPopulationTypeByIdQueryOptions,
  managedPopulationTypesByWorldQueryOptions,
} from "./queries/managedPopulationsQueries";
export { managedPopulationsQueryKeys } from "./queries/managedPopulationsQueryKeys";
export { createManagedPopulationInstanceInputSchema } from "./schemas/createManagedPopulationInstanceSchemas";
export { setConfiguredCullQuantityInputSchema } from "./schemas/setConfiguredCullQuantitySchemas";
export {
  createManagedPopulationTypeInputSchema,
  hardDeleteManagedPopulationTypeInputSchema,
  populationResourceEntrySchema,
  restoreManagedPopulationTypeInputSchema,
  softDeleteManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeInputSchema,
} from "./schemas/managedPopulationSchemas";
export { validateManagedPopulationTypeReferencesAgainstWorld } from "./utils/validateManagedPopulationTypeReferences";

export type { CreateManagedPopulationInstanceMutationIssue } from "./mutations/createManagedPopulationInstanceMutations";
export type { SetConfiguredCullQuantityMutationIssue } from "./mutations/setConfiguredCullQuantityMutations";
export type { ManagedPopulationTypeMutationIssue } from "./mutations/managedPopulationsMutations";
export type {
  CreateManagedPopulationInstanceInput,
  CreateManagedPopulationInstanceValues,
} from "./schemas/createManagedPopulationInstanceSchemas";
export type {
  SetConfiguredCullQuantityInput,
  SetConfiguredCullQuantityValues,
} from "./schemas/setConfiguredCullQuantitySchemas";
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
  CreateManagedPopulationInstanceResult,
  ManagedPopulationInstance,
  ManagedPopulationInstanceStatus,
  SetConfiguredCullQuantityResult,
} from "./types/managedPopulationInstanceTypes";
export type {
  HardDeleteManagedPopulationTypeResult,
  ManagedPopulationType,
  PopulationResourceEntry,
  RestoreManagedPopulationTypeResult,
  SoftDeleteManagedPopulationTypeResult,
} from "./types/managedPopulationTypes";
export type { ManagedPopulationTypeReferenceIssue } from "./utils/validateManagedPopulationTypeReferences";
