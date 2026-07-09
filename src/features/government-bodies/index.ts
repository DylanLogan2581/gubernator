// Government bodies feature — reusable voting-body primitive (#1116):
// named bodies ("The Senate", "Moot of Elders") for a nation or settlement,
// membership defined by composition rules and resolved via
// resolveBodyMembers (src/shared/government).
export {
  GovernmentBodiesSection,
  type GovernmentBodiesSectionProps,
} from "./components/BodiesSection";
export {
  createGovernmentBodyMutationOptions,
  deleteGovernmentBodyMutationOptions,
  GovernmentBodyMutationError,
  isGovernmentBodyMutationError,
  updateGovernmentBodyMutationOptions,
} from "./mutations/governmentBodiesMutations";
export type {
  DeleteGovernmentBodyInput,
  GovernmentBodyMutationIssue,
  UpdateGovernmentBodyInput,
} from "./mutations/governmentBodiesMutations";
export {
  nationBodyResolverContextQueryOptions,
  nationGovernmentBodiesQueryOptions,
  settlementBodyResolverContextQueryOptions,
  settlementGovernmentBodiesQueryOptions,
} from "./queries/governmentBodiesQueries";
export { governmentBodiesQueryKeys } from "./queries/governmentBodiesQueryKeys";
export {
  bodyCompositionRuleSchema,
  bodyCompositionSchema,
  createGovernmentBodyInputSchema,
  deleteGovernmentBodyInputSchema,
  updateGovernmentBodyInputSchema,
} from "./schemas/governmentBodySchemas";
export type {
  CreateGovernmentBodyInput,
  CreateGovernmentBodyValues,
  UpdateGovernmentBodyValues,
} from "./schemas/governmentBodySchemas";
export type {
  BodyResolverContext,
  BodyScope,
  GovernmentBody,
} from "./types/governmentBodyTypes";
