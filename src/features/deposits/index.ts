// Deposits feature — deposit types for world configuration and deposit instances
// for per-settlement deposit management (Epic 5).

export { DepositsConfigPanel } from "./components/DepositsConfigPanel";
export { SettlementDepositsPanel } from "./components/SettlementDepositsPanel";
export {
  CreateDepositInstanceMutationError,
  createDepositInstanceMutationOptions,
  isCreateDepositInstanceMutationError,
} from "./mutations/createDepositInstanceMutations";
export {
  RemoveDepositInstanceMutationError,
  isRemoveDepositInstanceMutationError,
  removeDepositInstanceMutationOptions,
} from "./mutations/removeDepositInstanceMutations";
export {
  SetDepositInstanceMaxWorkersMutationError,
  isSetDepositInstanceMaxWorkersMutationError,
  setDepositInstanceMaxWorkersMutationOptions,
} from "./mutations/setDepositInstanceMaxWorkersMutations";
export {
  DepositTypeMutationError,
  createDepositTypeMutationOptions,
  hardDeleteDepositTypeMutationOptions,
  isDepositTypeMutationError,
  restoreDepositTypeMutationOptions,
  softDeleteDepositTypeMutationOptions,
  updateDepositTypeMutationOptions,
} from "./mutations/depositsMutations";
export { depositInstancesBySettlementQueryOptions } from "./queries/depositInstancesQueries";
export {
  activeDepositTypesByWorldQueryOptions,
  depositTypeByIdQueryOptions,
  depositTypesByWorldQueryOptions,
} from "./queries/depositsQueries";
export { depositsQueryKeys } from "./queries/depositsQueryKeys";
export {
  createDepositInstanceInputSchema,
  depositInstanceResourceEntrySchema,
} from "./schemas/createDepositInstanceSchemas";
export { removeDepositInstanceInputSchema } from "./schemas/removeDepositInstanceSchemas";
export { setDepositInstanceMaxWorkersInputSchema } from "./schemas/setDepositInstanceMaxWorkersSchemas";
export {
  createDepositTypeInputSchema,
  hardDeleteDepositTypeInputSchema,
  restoreDepositTypeInputSchema,
  softDeleteDepositTypeInputSchema,
  updateDepositTypeInputSchema,
  workerInputEntrySchema,
} from "./schemas/depositSchemas";
export { validateDepositTypeReferencesAgainstWorld } from "./utils/validateDepositTypeReferences";

export type { CreateDepositInstanceMutationIssue } from "./mutations/createDepositInstanceMutations";
export type { DepositTypeMutationIssue } from "./mutations/depositsMutations";
export type { RemoveDepositInstanceMutationIssue } from "./mutations/removeDepositInstanceMutations";
export type { SetDepositInstanceMaxWorkersMutationIssue } from "./mutations/setDepositInstanceMaxWorkersMutations";
export type {
  CreateDepositInstanceInput,
  CreateDepositInstanceValues,
  DepositInstanceResourceEntryInput,
  DepositInstanceResourceEntryValues,
} from "./schemas/createDepositInstanceSchemas";
export type {
  RemoveDepositInstanceInput,
  RemoveDepositInstanceValues,
} from "./schemas/removeDepositInstanceSchemas";
export type {
  SetDepositInstanceMaxWorkersInput,
  SetDepositInstanceMaxWorkersValues,
} from "./schemas/setDepositInstanceMaxWorkersSchemas";
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
  CreateDepositInstanceResult,
  DepositInstance,
  DepositInstanceResource,
  DepositInstanceStatus,
  RemoveDepositInstanceResult,
  SetDepositInstanceMaxWorkersResult,
} from "./types/depositInstanceTypes";
export type {
  DepositType,
  HardDeleteDepositTypeResult,
  RestoreDepositTypeResult,
  SoftDeleteDepositTypeResult,
  WorkerInputEntry,
} from "./types/depositTypes";
export type { DepositTypeReferenceIssue } from "./utils/validateDepositTypeReferences";
