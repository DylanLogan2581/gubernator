// Public surface of the src/shared/government module.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export {
  ALLOWED_NATION_OFFICE_TYPES,
  GOVERNMENT_RULES,
  GOVERNMENT_TAX_EFFICIENCY,
  GOVERNMENT_TYPES,
  NATION_OFFICE_TYPES,
} from "./governmentTypes.ts";
export type {
  GovernmentRules,
  GovernmentType,
  NationOfficeType,
  OfficeType,
  ReadinessMode,
  SuccessionMode,
} from "./governmentTypes.ts";

export {
  getReadinessVoters,
  getSuccessionCandidates,
} from "./governmentSelectors.ts";
export type {
  CitizenSuccessionInfo,
  OfficeHolder,
  ReadinessVotersInput,
  SuccessionCandidatesInput,
} from "./governmentSelectors.ts";

export { resolveBodyMembers } from "./governmentBodies.ts";
export type {
  BodyCompositionRule,
  BodyOfficeHolder,
  GovernmentBodyComposition,
  ResolveBodyMembersData,
} from "./governmentBodies.ts";
