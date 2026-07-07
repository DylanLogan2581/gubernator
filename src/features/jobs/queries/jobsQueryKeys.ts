import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { JobsPageParams } from "./jobsQueries";
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
  // Nested under byWorld so the existing softDelete/restore/update/create
  // invalidation (which invalidates byWorld(worldId) as a prefix) also
  // refetches the paginated config-panel view without any changes there.
  page: (worldId: string, params: JobsPageParams) =>
    [...jobsQueryKeys.byWorld(worldId), "page", params] as const,
} as const;
