// Jobs feature — define job types and their input/output rules for worlds.
// Implemented in Epic 4.

export { JobsConfigPanel } from "./components/JobsConfigPanel";
export {
  JobMutationError,
  createJobMutationOptions,
  hardDeleteJobMutationOptions,
  isJobMutationError,
  restoreJobMutationOptions,
  softDeleteJobMutationOptions,
  updateJobMutationOptions,
} from "./mutations/jobsMutations";
export {
  activeJobsByWorldQueryOptions,
  jobByIdQueryOptions,
  jobsByTypeQueryOptions,
  jobsByWorldQueryOptions,
} from "./queries/jobsQueries";
export { jobsQueryKeys } from "./queries/jobsQueryKeys";
export {
  createJobInputSchema,
  hardDeleteJobInputSchema,
  jobIoEntrySchema,
  restoreJobInputSchema,
  softDeleteJobInputSchema,
  updateJobInputSchema,
} from "./schemas/jobSchemas";
export { parseJobType } from "./utils/parseJobType";
export { validateJobReferencesAgainstWorld } from "./utils/validateJobReferences";

export type { JobMutationIssue } from "./mutations/jobsMutations";
export type {
  CreateJobInput,
  CreateJobValues,
  HardDeleteJobInput,
  HardDeleteJobValues,
  JobIoEntryInput,
  JobIoEntryValues,
  RestoreJobInput,
  RestoreJobValues,
  SoftDeleteJobInput,
  SoftDeleteJobValues,
  UpdateJobInput,
  UpdateJobValues,
} from "./schemas/jobSchemas";
export type {
  HardDeleteJobResult,
  JobDefinition,
  JobIoEntry,
  JobType,
  RestoreJobResult,
  SoftDeleteJobResult,
} from "./types/jobTypes";
export type { JobReferenceIssue } from "./utils/validateJobReferences";
