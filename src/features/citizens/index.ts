// Citizens feature — query and mutation API for NPCs and player characters.
// Implemented in Epic 3.
export { CitizenDetailPage } from "./components/CitizenDetailPage";
export { CitizensPanel } from "./components/CitizensPanel";
export { SettlementAssignmentBoard } from "./components/SettlementAssignmentBoard";
export { NpcFlavorLine } from "./components/NpcFlavorLine";
export { NpcFlavorEditor } from "./components/NpcFlavorEditor";
// Partnership exports moved to partnerships feature; re-exported for backward compatibility
export { PartnershipHistoryPanel } from "@/features/partnerships";
export {
  BulkConstructionPoolMutationError,
  isBulkConstructionPoolMutationError,
  setBulkConstructionPoolMutationOptions,
} from "./mutations/bulkConstructionPoolMutations";
export {
  BulkStandardJobAssignmentMutationError,
  isBulkStandardJobAssignmentMutationError,
  setBulkStandardJobAssignmentMutationOptions,
} from "./mutations/bulkStandardJobAssignmentMutations";
export {
  isPerTargetAssignmentMutationError,
  PerTargetAssignmentMutationError,
  setPerTargetAssignmentMutationOptions,
} from "./mutations/perTargetAssignmentMutations";
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
} from "@/features/partnerships";
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
export { settlementConstructionProjectCountsQueryOptions } from "./queries/settlementConstructionProjectCountsQueries";
export { settlementJobCountsQueryOptions } from "./queries/settlementJobCountsQueries";
export { settlementTargetAssignmentsQueryOptions } from "./queries/settlementTargetAssignmentsQueries";
export {
  isManagerRole,
  isPlayerRole,
  managerScopeLabel,
} from "./utils/citizenRoles";
export {
  emptyNpcFlavor,
  generateNpcFlavor,
  renderNpcFlavorLine,
  roleLabelForAssignment,
  roleLabelForAssignmentType,
  UNASSIGNED_ROLE_LABEL,
} from "./utils/npcFlavor";
export {
  citizenAggregateStatsForNationQueryOptions,
  citizenAggregateStatsForSettlementQueryOptions,
  citizenByIdQueryOptions,
  citizensInSettlementQueryOptions,
  citizensInWorldQueryOptions,
  playerCharactersInNationQueryOptions,
  toCitizen,
  unpairedAliveCitizensInWorldQueryOptions,
} from "./queries/citizensQueries";
export { citizensQueryKeys } from "./queries/citizensQueryKeys";
export {
  activePartnershipForCitizenQueryOptions,
  partnershipsForCitizenQueryOptions,
} from "@/features/partnerships";
export { setBulkConstructionPoolInputSchema } from "./schemas/setBulkConstructionPoolSchemas";
export { setBulkStandardJobAssignmentInputSchema } from "./schemas/setBulkStandardJobAssignmentSchemas";
export { setPerTargetAssignmentInputSchema } from "./schemas/setPerTargetAssignmentSchemas";
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
} from "@/features/partnerships";

export type { BulkConstructionPoolMutationIssue } from "./mutations/bulkConstructionPoolMutations";
export type { BulkStandardJobAssignmentMutationIssue } from "./mutations/bulkStandardJobAssignmentMutations";
export type { PerTargetAssignmentMutationIssue } from "./mutations/perTargetAssignmentMutations";
export type { CitizenMutationIssue } from "./mutations/citizensMutations";
export type { PartnershipMutationIssue } from "@/features/partnerships";
export type { PlayerCharacterRoleMutationIssue } from "./mutations/playerCharacterRoleMutations";
export type {
  SetBulkConstructionPoolInput,
  SetBulkConstructionPoolValues,
} from "./schemas/setBulkConstructionPoolSchemas";
export type {
  SetBulkStandardJobAssignmentInput,
  SetBulkStandardJobAssignmentValues,
} from "./schemas/setBulkStandardJobAssignmentSchemas";
export type {
  SetPerTargetAssignmentInput,
  SetPerTargetAssignmentValues,
} from "./schemas/setPerTargetAssignmentSchemas";
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
} from "@/features/partnerships";
export type { CitizenRow } from "./queries/citizensQueries";
export type {
  BulkConstructionAssignmentResult,
  BulkStandardJobAssignmentResult,
  PerTargetAssignmentResult,
  SettlementConstructionProjectCount,
  SettlementJobCount,
} from "./types/bulkAssignmentTypes";
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
export type { Partnership, PartnershipStatus } from "@/features/partnerships";
