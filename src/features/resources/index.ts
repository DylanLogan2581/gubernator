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
  activeResourcesByWorldQueryOptions,
  resourceByIdQueryOptions,
  resourcesByWorldQueryOptions,
} from "./queries/resourcesQueries";
export { resourcesQueryKeys } from "./queries/resourcesQueryKeys";
export {
  createResourceInputSchema,
  hardDeleteResourceInputSchema,
  restoreResourceInputSchema,
  softDeleteResourceInputSchema,
  updateResourceInputSchema,
} from "./schemas/resourceSchemas";

export type { ResourceMutationIssue } from "./mutations/resourcesMutations";
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
  HardDeleteResourceResult,
  Resource,
  RestoreResourceResult,
  SoftDeleteResourceResult,
} from "./types/resourceTypes";
