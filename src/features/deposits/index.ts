// Deposits feature — deposit types for world configuration.
// Deposit instances live in Epic 5; this module covers type-level data only.

export {
  DepositTypeMutationError,
  createDepositTypeMutationOptions,
  isDepositTypeMutationError,
  setDepositTypeActiveMutationOptions,
  updateDepositTypeMutationOptions,
} from "./mutations/depositsMutations";
export {
  activeDepositTypesByWorldQueryOptions,
  depositTypeByIdQueryOptions,
  depositTypesByWorldQueryOptions,
} from "./queries/depositsQueries";
export { depositsQueryKeys } from "./queries/depositsQueryKeys";
export {
  createDepositTypeInputSchema,
  setDepositTypeActiveInputSchema,
  updateDepositTypeInputSchema,
  workerInputEntrySchema,
} from "./schemas/depositSchemas";
export { validateDepositTypeReferencesAgainstWorld } from "./utils/validateDepositTypeReferences";

export type { DepositTypeMutationIssue } from "./mutations/depositsMutations";
export type {
  CreateDepositTypeInput,
  CreateDepositTypeValues,
  SetDepositTypeActiveInput,
  SetDepositTypeActiveValues,
  UpdateDepositTypeInput,
  UpdateDepositTypeValues,
  WorkerInputEntryInput,
  WorkerInputEntryValues,
} from "./schemas/depositSchemas";
export type {
  DepositType,
  SetDepositTypeActiveResult,
  WorkerInputEntry,
} from "./types/depositTypes";
export type { DepositTypeReferenceIssue } from "./utils/validateDepositTypeReferences";
