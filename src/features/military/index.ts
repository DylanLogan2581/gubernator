// Military feature — Epic 13 foundation: world-admin-defined unit types
// (levy, spearman, knight...) with costs, upkeep, desertion rate, and
// recruitment requirements. No consumer (recruited army units) yet.

export { MilitaryConfigPanel } from "./components/MilitaryConfigPanel";
export {
  createUnitTypeMutationOptions,
  deleteUnitTypeMutationOptions,
  isUnitTypeMutationError,
  UnitTypeMutationError,
  updateUnitTypeMutationOptions,
} from "./mutations/unitTypesMutations";
export { unitTypesByWorldQueryOptions } from "./queries/unitTypesQueries";
export { unitTypesQueryKeys } from "./queries/unitTypesQueryKeys";
export {
  createUnitTypeInputSchema,
  deleteUnitTypeInputSchema,
  updateUnitTypeInputSchema,
} from "./schemas/unitTypeSchemas";

export type { UnitTypeMutationIssue } from "./mutations/unitTypesMutations";
export type {
  CreateUnitTypeInput,
  CreateUnitTypeValues,
  DeleteUnitTypeInput,
  DeleteUnitTypeValues,
  UpdateUnitTypeInput,
  UpdateUnitTypeValues,
} from "./schemas/unitTypeSchemas";
export type { DeleteUnitTypeResult, UnitType } from "./types/unitTypeTypes";
