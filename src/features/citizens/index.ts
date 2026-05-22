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
  citizenAggregateStatsForNationQueryOptions,
  citizenAggregateStatsForSettlementQueryOptions,
  citizenByIdQueryOptions,
  citizensInSettlementQueryOptions,
} from "./queries/citizensQueries";
export { citizensQueryKeys } from "./queries/citizensQueryKeys";
export {
  citizenRoleAssignmentSchema,
  createNpcInputSchema,
  createPlayerCharacterInputSchema,
  markCitizenDeadInputSchema,
  reviveCitizenInputSchema,
  updateCitizenCoreInputSchema,
  updateCitizenNpcFieldsInputSchema,
} from "./schemas/citizenSchemas";

export type { CitizenMutationIssue } from "./mutations/citizensMutations";
export type {
  CitizenRoleAssignmentInput,
  CitizenRoleAssignmentValues,
  CreateNpcInput,
  CreateNpcValues,
  CreatePlayerCharacterInput,
  CreatePlayerCharacterValues,
  MarkCitizenDeadInput,
  MarkCitizenDeadValues,
  ReviveCitizenInput,
  ReviveCitizenValues,
  UpdateCitizenCoreInput,
  UpdateCitizenCoreValues,
  UpdateCitizenNpcFieldsInput,
  UpdateCitizenNpcFieldsValues,
} from "./schemas/citizenSchemas";
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
