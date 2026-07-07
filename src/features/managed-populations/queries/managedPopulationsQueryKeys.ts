import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { ManagedPopulationTypesPageParams } from "./managedPopulationsQueries";

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
  // Nested under byWorld so the existing softDelete/restore/update/create
  // invalidation (which invalidates byWorld(worldId) as a prefix) also
  // refetches the paginated config-panel view without any changes there.
  page: (worldId: string, params: ManagedPopulationTypesPageParams) =>
    [...managedPopulationsQueryKeys.byWorld(worldId), "page", params] as const,
  instancesBySettlement: (settlementId: string) =>
    [
      ...managedPopulationsQueryKeys.all,
      "instances-by-settlement",
      settlementId,
    ] as const,
  snapshotsBySettlement: (settlementId: string) =>
    [
      ...managedPopulationsQueryKeys.all,
      "snapshots-by-settlement",
      settlementId,
    ] as const,
} as const;
