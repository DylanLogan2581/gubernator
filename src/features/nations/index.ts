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
  NationRelationshipMutationError,
  isNationRelationshipMutationError,
  proposeBilateralMutationOptions,
  respondToBilateralMutationOptions,
  setUnilateralStanceMutationOptions,
  withdrawFromBilateralMutationOptions,
} from "./mutations/nationRelationshipMutations";
export {
  nationByIdQueryOptions,
  nationSettlementsQueryOptions,
  nationsListQueryOptions,
} from "./queries/nationsQueries";
export {
  nationRelationshipPairQueryOptions,
  nationRelationshipsFromNationQueryOptions,
} from "./queries/nationRelationshipQueries";
export { nationsQueryKeys } from "./queries/nationsQueryKeys";
export {
  createNationInputSchema,
  deleteNationInputSchema,
  setNationHiddenInputSchema,
  updateNationDetailsInputSchema,
} from "./schemas/nationSchemas";
export {
  proposeBilateralInputSchema,
  respondToBilateralInputSchema,
  setUnilateralStanceInputSchema,
  withdrawFromBilateralInputSchema,
} from "./schemas/nationRelationshipSchemas";

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
export type {
  ProposeBilateralInput,
  ProposeBilateralValues,
  RespondToBilateralInput,
  RespondToBilateralValues,
  SetUnilateralStanceInput,
  SetUnilateralStanceValues,
  WithdrawFromBilateralInput,
  WithdrawFromBilateralValues,
} from "./schemas/nationRelationshipSchemas";
export type { DeleteNationResult } from "./mutations/nationsMutations";
export type { NationRelationshipMutationIssue } from "./mutations/nationRelationshipMutations";
export type { Nation, NationSettlement } from "./types/nationTypes";
export type {
  NationBilateralResponse,
  NationBilateralStance,
  NationRelationship,
  NationRelationshipPendingStatus,
  NationRelationshipStance,
  NationUnilateralStance,
} from "./types/nationRelationshipTypes";
