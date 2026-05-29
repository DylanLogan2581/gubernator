// Jobs feature — define job types and their input/output rules for worlds.
// Implemented in Epic 4.

export {
  JobMutationError,
  createJobMutationOptions,
  isJobMutationError,
  setJobActiveMutationOptions,
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
  jobIoEntrySchema,
  setJobActiveInputSchema,
  updateJobInputSchema,
} from "./schemas/jobSchemas";
export { validateJobReferencesAgainstWorld } from "./utils/validateJobReferences";

export type { JobMutationIssue } from "./mutations/jobsMutations";
export type {
  CreateJobInput,
  CreateJobValues,
  JobIoEntryInput,
  JobIoEntryValues,
  SetJobActiveInput,
  SetJobActiveValues,
  UpdateJobInput,
  UpdateJobValues,
} from "./schemas/jobSchemas";
export type {
  JobDefinition,
  JobIoEntry,
  JobType,
  SetJobActiveResult,
} from "./types/jobTypes";
export type { JobReferenceIssue } from "./utils/validateJobReferences";
