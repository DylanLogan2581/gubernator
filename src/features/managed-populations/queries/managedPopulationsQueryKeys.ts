import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const managedPopulationsQueryKeys = {
  all: authStateQueryCacheKeys.managedPopulationsAll,
  activeByWorld: (worldId: string) =>
    [...managedPopulationsQueryKeys.all, "active-by-world", worldId] as const,
  byWorld: (worldId: string) =>
    [...managedPopulationsQueryKeys.all, "by-world", worldId] as const,
  detail: (managedPopulationTypeId: string) =>
    [
      ...managedPopulationsQueryKeys.all,
      "detail",
      managedPopulationTypeId,
    ] as const,
} as const;
