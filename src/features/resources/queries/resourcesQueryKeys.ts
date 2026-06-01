import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const resourcesQueryKeys = {
  all: authStateQueryCacheKeys.resourcesAll,
  activeByWorld: (worldId: string) =>
    [...resourcesQueryKeys.all, "active-by-world", worldId] as const,
  byWorld: (worldId: string) =>
    [...resourcesQueryKeys.all, "by-world", worldId] as const,
  detail: (resourceId: string) =>
    [...resourcesQueryKeys.all, "detail", resourceId] as const,
  stockpilesBySettlement: (settlementId: string) =>
    [
      ...resourcesQueryKeys.all,
      "stockpiles-by-settlement",
      settlementId,
    ] as const,
} as const;
