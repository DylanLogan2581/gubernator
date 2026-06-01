import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { JobType } from "../types/jobTypes";

export const jobsQueryKeys = {
  all: authStateQueryCacheKeys.jobsAll,
  activeByWorld: (worldId: string) =>
    [...jobsQueryKeys.all, "active-by-world", worldId] as const,
  byType: (worldId: string, jobType: JobType) =>
    [...jobsQueryKeys.all, "by-type", worldId, jobType] as const,
  byWorld: (worldId: string) =>
    [...jobsQueryKeys.all, "by-world", worldId] as const,
  detail: (jobId: string) => [...jobsQueryKeys.all, "detail", jobId] as const,
} as const;
