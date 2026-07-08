export { ReligionsConfigPanel } from "./components/ReligionsConfigPanel";
export {
  ReligionMutationError,
  createReligionMutationOptions,
  deleteReligionMutationOptions,
  isReligionMutationError,
  updateReligionMutationOptions,
} from "./mutations/religionsMutations";
export {
  religionByIdQueryOptions,
  religionsByWorldQueryOptions,
} from "./queries/religionsQueries";
export { religionsQueryKeys } from "./queries/religionsQueryKeys";
export {
  createReligionInputSchema,
  deleteReligionInputSchema,
  updateReligionInputSchema,
} from "./schemas/religionSchemas";

export type { ReligionMutationIssue } from "./mutations/religionsMutations";
export type { DeleteReligionResult } from "./mutations/religionsMutations";
export type {
  CreateReligionInput,
  CreateReligionValues,
  DeleteReligionInput,
  DeleteReligionValues,
  UpdateReligionInput,
  UpdateReligionValues,
} from "./schemas/religionSchemas";
export type { Religion } from "./types/religionTypes";
