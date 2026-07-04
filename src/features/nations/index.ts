// Nations feature — query and mutation API for world-scoped nations.
// Implemented in Epic 3.
export { NationDetailPage } from "./components/NationDetailPage";
export { useNationDetailContext } from "./components/NationDetailPage/NationDetailContext";
export { NationSectionRedirect } from "./components/NationDetailPage/NationSectionRedirect";
export { NationDeleteSection } from "./components/NationDetailPage/DeleteSection";
export { NationDetailsSection } from "./components/NationDetailPage/DetailsSection";
export { NationHiddenToggleSection } from "./components/NationDetailPage/HiddenToggleSection";
export { NationReportsSection } from "./components/NationDetailPage/NationReportsSection";
export { NationRelationshipsSection } from "./components/NationDetailPage/RelationshipsSection";
export { NationRoleAssignmentSection } from "./components/NationDetailPage/RoleAssignmentSection";
export { NationSettlementsSection } from "./components/NationDetailPage/SettlementsSection";
export { NationListPage } from "./components/NationListPage";
export { NationOverviewStatTiles } from "./components/NationOverviewStatTiles";
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
  nationRelationshipsToNationQueryOptions,
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
