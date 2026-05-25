// Citizens feature — query and mutation API for NPCs and player characters.
// Implemented in Epic 3.
export { CitizenDetailPage } from "./components/CitizenDetailPage";
export { CitizensPanel } from "./components/CitizensPanel";
export { NpcFlavorLine } from "./components/NpcFlavorLine";
export { NpcFlavorEditor } from "./components/NpcFlavorEditor";
export { PartnershipHistoryPanel } from "./components/PartnershipHistoryPanel";
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
  assignmentsInSettlementQueryOptions,
  currentAssignmentForCitizenQueryOptions,
} from "./queries/citizenAssignmentsQueries";
export {
  emptyNpcFlavor,
  generateNpcFlavor,
  renderNpcFlavorLine,
  roleLabelForAssignment,
  UNASSIGNED_ROLE_LABEL,
} from "./utils/npcFlavor";
export {
  citizenAggregateStatsForNationQueryOptions,
  citizenAggregateStatsForSettlementQueryOptions,
  citizenByIdQueryOptions,
  citizensInSettlementQueryOptions,
  playerCharactersInNationQueryOptions,
  toCitizen,
  unpairedAliveCitizensInWorldQueryOptions,
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
export type { CitizenRow } from "./queries/citizensQueries";
export type { CitizenAssignment } from "./types/citizenAssignmentTypes";
export type { NpcFlavor, NpcFlavorConfig } from "./utils/npcFlavor";
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
