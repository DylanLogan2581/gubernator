// Partnerships feature — query and mutation API for citizen partnerships.
export { PartnershipHistoryPanel } from "./components";
export {
  createPartnershipMutationOptions,
  dissolvePartnershipMutationOptions,
  isPartnershipMutationError,
  markPartnershipWidowedMutationOptions,
  PartnershipMutationError,
  reassignPartnerMutationOptions,
} from "./mutations/partnershipsMutations";
export {
  activePartnershipForCitizenQueryOptions,
  partnershipsForCitizenQueryOptions,
} from "./queries/partnershipsQueries";
export {
  createPartnershipInputSchema,
  dissolvePartnershipInputSchema,
  markPartnershipWidowedInputSchema,
  reassignPartnerInputSchema,
} from "./schemas/partnershipSchemas";
export type { PartnershipMutationIssue } from "./mutations/partnershipsMutations";
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
export type { Partnership, PartnershipStatus } from "./types/partnershipTypes";
