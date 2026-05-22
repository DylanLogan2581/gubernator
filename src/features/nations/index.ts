// Nations feature — query and mutation API for world-scoped nations.
// Implemented in Epic 3.
export {
  NationMutationError,
  createNationMutationOptions,
  deleteNationMutationOptions,
  isNationMutationError,
  setNationHiddenMutationOptions,
  updateNationDetailsMutationOptions,
} from "./mutations/nationsMutations";
export {
  nationByIdQueryOptions,
  nationSettlementsQueryOptions,
  nationsListQueryOptions,
} from "./queries/nationsQueries";
export { nationsQueryKeys } from "./queries/nationsQueryKeys";
export {
  createNationInputSchema,
  deleteNationInputSchema,
  setNationHiddenInputSchema,
  updateNationDetailsInputSchema,
} from "./schemas/nationSchemas";

export type {
  CreateNationInput,
  CreateNationValues,
  DeleteNationInput,
  DeleteNationValues,
  SetNationHiddenInput,
  SetNationHiddenValues,
  UpdateNationDetailsInput,
  UpdateNationDetailsValues,
} from "./schemas/nationSchemas";
export type { DeleteNationResult } from "./mutations/nationsMutations";
export type { Nation, NationSettlement } from "./types/nationTypes";
