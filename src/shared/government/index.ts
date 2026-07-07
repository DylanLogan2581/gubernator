// Public surface of the src/shared/government module.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export { GOVERNMENT_RULES, GOVERNMENT_TYPES } from "./governmentTypes.ts";
export type {
  GovernmentRules,
  GovernmentType,
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
