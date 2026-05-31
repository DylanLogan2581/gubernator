// Deposits feature — deposit types for world configuration.
// Deposit instances live in Epic 5; this module covers type-level data only.

export { DepositsConfigPanel } from "./components/DepositsConfigPanel";
export {
  DepositTypeMutationError,
  createDepositTypeMutationOptions,
  hardDeleteDepositTypeMutationOptions,
  isDepositTypeMutationError,
  restoreDepositTypeMutationOptions,
  softDeleteDepositTypeMutationOptions,
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
  hardDeleteDepositTypeInputSchema,
  restoreDepositTypeInputSchema,
  softDeleteDepositTypeInputSchema,
  updateDepositTypeInputSchema,
  workerInputEntrySchema,
} from "./schemas/depositSchemas";
export { validateDepositTypeReferencesAgainstWorld } from "./utils/validateDepositTypeReferences";

export type { DepositTypeMutationIssue } from "./mutations/depositsMutations";
export type {
  CreateDepositTypeInput,
  CreateDepositTypeValues,
  HardDeleteDepositTypeInput,
  HardDeleteDepositTypeValues,
  RestoreDepositTypeInput,
  RestoreDepositTypeValues,
  SoftDeleteDepositTypeInput,
  SoftDeleteDepositTypeValues,
  UpdateDepositTypeInput,
  UpdateDepositTypeValues,
  WorkerInputEntryInput,
  WorkerInputEntryValues,
} from "./schemas/depositSchemas";
export type {
  DepositType,
  HardDeleteDepositTypeResult,
  RestoreDepositTypeResult,
  SoftDeleteDepositTypeResult,
  WorkerInputEntry,
} from "./types/depositTypes";
export type { DepositTypeReferenceIssue } from "./utils/validateDepositTypeReferences";
