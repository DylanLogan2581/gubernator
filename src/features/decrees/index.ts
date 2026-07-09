// Decrees feature (#1121): standalone proclamations for a nation or
// settlement's government tab -- pure roleplay/DM reference, zero
// simulation effects. Every write is RPC-only. Distinct from
// law-amendments' decree-procedure amendments, which live in that feature
// and never write here.
export {
  DecreesSection,
  type DecreesSectionProps,
} from "./components/DecreesSection";
export {
  DecreeMutationError,
  isDecreeMutationError,
  issueDecreeMutationOptions,
  revokeDecreeMutationOptions,
} from "./mutations/decreesMutations";
export type { DecreeMutationIssue } from "./mutations/decreesMutations";
export {
  nationDecreesQueryOptions,
  settlementDecreesQueryOptions,
} from "./queries/decreesQueries";
export { decreesQueryKeys } from "./queries/decreesQueryKeys";
export {
  issueDecreeInputSchema,
  revokeDecreeInputSchema,
} from "./schemas/decreeSchemas";
export type {
  IssueDecreeInput,
  RevokeDecreeInput,
} from "./schemas/decreeSchemas";
export type { Decree } from "./types/decreeTypes";
