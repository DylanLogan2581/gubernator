// Citizens feature — query and mutation API for NPCs and player characters.
// Implemented in Epic 3.
export {
  CitizenMutationError,
  createNpcMutationOptions,
  createPlayerCharacterMutationOptions,
  isCitizenMutationError,
  markCitizenDeadMutationOptions,
  reviveCitizenMutationOptions,
  updateCitizenCoreMutationOptions,
  updateCitizenNpcFieldsMutationOptions,
} from "./mutations/citizensMutations";
export {
  createPartnershipMutationOptions,
  dissolvePartnershipMutationOptions,
  isPartnershipMutationError,
  markPartnershipWidowedMutationOptions,
  PartnershipMutationError,
  reassignPartnerMutationOptions,
} from "./mutations/partnershipsMutations";
export {
  assignCitizenRoleMutationOptions,
  isPlayerCharacterRoleMutationError,
  linkUserToCitizenMutationOptions,
  PlayerCharacterRoleMutationError,
  revokeCitizenRoleMutationOptions,
  unlinkUserFromCitizenMutationOptions,
} from "./mutations/playerCharacterRoleMutations";
export {
  citizenAggregateStatsForNationQueryOptions,
  citizenAggregateStatsForSettlementQueryOptions,
  citizenByIdQueryOptions,
  citizensInSettlementQueryOptions,
} from "./queries/citizensQueries";
export { citizensQueryKeys } from "./queries/citizensQueryKeys";
export {
  activePartnershipForCitizenQueryOptions,
  partnershipsForCitizenQueryOptions,
} from "./queries/partnershipsQueries";
export {
  assignCitizenRoleInputSchema,
  citizenRoleAssignmentSchema,
  createNpcInputSchema,
  createPlayerCharacterInputSchema,
  linkUserToCitizenInputSchema,
  markCitizenDeadInputSchema,
  revokeCitizenRoleInputSchema,
  reviveCitizenInputSchema,
  unlinkUserFromCitizenInputSchema,
  updateCitizenCoreInputSchema,
  updateCitizenNpcFieldsInputSchema,
} from "./schemas/citizenSchemas";
export {
  createPartnershipInputSchema,
  dissolvePartnershipInputSchema,
  markPartnershipWidowedInputSchema,
  reassignPartnerInputSchema,
} from "./schemas/partnershipSchemas";

export type { CitizenMutationIssue } from "./mutations/citizensMutations";
export type { PartnershipMutationIssue } from "./mutations/partnershipsMutations";
export type { PlayerCharacterRoleMutationIssue } from "./mutations/playerCharacterRoleMutations";
export type {
  AssignCitizenRoleInput,
  AssignCitizenRoleValues,
  CitizenRoleAssignmentInput,
  CitizenRoleAssignmentValues,
  CreateNpcInput,
  CreateNpcValues,
  CreatePlayerCharacterInput,
  CreatePlayerCharacterValues,
  LinkUserToCitizenInput,
  LinkUserToCitizenValues,
  MarkCitizenDeadInput,
  MarkCitizenDeadValues,
  RevokeCitizenRoleInput,
  RevokeCitizenRoleValues,
  ReviveCitizenInput,
  ReviveCitizenValues,
  UnlinkUserFromCitizenInput,
  UnlinkUserFromCitizenValues,
  UpdateCitizenCoreInput,
  UpdateCitizenCoreValues,
  UpdateCitizenNpcFieldsInput,
  UpdateCitizenNpcFieldsValues,
} from "./schemas/citizenSchemas";
export type {
  CreatePartnershipInput,
  CreatePartnershipValues,
  DissolvePartnershipInput,
  DissolvePartnershipValues,
  MarkPartnershipWidowedInput,
  MarkPartnershipWidowedValues,
  ReassignPartnerInput,
  ReassignPartnerValues,
} from "./schemas/partnershipSchemas";
export type {
  Citizen,
  CitizenAggregateStats,
  CitizenAssignmentType,
  CitizenAssignmentTypeBreakdown,
  CitizenRoleType,
  CitizenStatus,
  CitizenStatusBreakdown,
  CitizenType,
  CitizenTypeBreakdown,
} from "./types/citizenTypes";
export type { Partnership, PartnershipStatus } from "./types/partnershipTypes";
