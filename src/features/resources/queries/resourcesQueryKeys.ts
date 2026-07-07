import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { ResourcesPageParams } from "./resourcesQueries";

export const resourcesQueryKeys = {
  all: authStateQueryCacheKeys.resourcesAll,
  activeByWorld: (worldId: string) =>
    [...resourcesQueryKeys.all, "active-by-world", worldId] as const,
  byWorld: (worldId: string) =>
    [...resourcesQueryKeys.all, "by-world", worldId] as const,
  detail: (resourceId: string) =>
    [...resourcesQueryKeys.all, "detail", resourceId] as const,
  // Nested under byWorld so the existing softDelete/restore/update/create
  // invalidation (which invalidates byWorld(worldId) as a prefix) also
  // refetches the paginated config-panel view without any changes there.
  page: (worldId: string, params: ResourcesPageParams) =>
    [...resourcesQueryKeys.byWorld(worldId), "page", params] as const,
  stockpilesBySettlement: (settlementId: string) =>
    [
      ...resourcesQueryKeys.all,
      "stockpiles-by-settlement",
      settlementId,
    ] as const,
} as const;
