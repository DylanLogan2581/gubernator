import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { DepositTypesPageParams } from "./depositsQueries";

export const depositsQueryKeys = {
  all: authStateQueryCacheKeys.depositsAll,
  activeByWorld: (worldId: string) =>
    [...depositsQueryKeys.all, "active-by-world", worldId] as const,
  byWorld: (worldId: string) =>
    [...depositsQueryKeys.all, "by-world", worldId] as const,
  detail: (depositTypeId: string) =>
    [...depositsQueryKeys.all, "detail", depositTypeId] as const,
  // Nested under byWorld so the existing softDelete/restore/update/create
  // invalidation (which invalidates byWorld(worldId) as a prefix) also
  // refetches the paginated config-panel view without any changes there.
  page: (worldId: string, params: DepositTypesPageParams) =>
    [...depositsQueryKeys.byWorld(worldId), "page", params] as const,
  instanceById: (instanceId: string) =>
    [...depositsQueryKeys.all, "instance-detail", instanceId] as const,
  instancesBySettlement: (settlementId: string) =>
    [
      ...depositsQueryKeys.all,
      "instances-by-settlement",
      settlementId,
    ] as const,
  instancesByNations: (nationIds: readonly string[]) =>
    [...depositsQueryKeys.all, "instances-by-nations", ...nationIds] as const,
  instancesByWorld: (worldId: string) =>
    [...depositsQueryKeys.all, "instances-by-world", worldId] as const,
} as const;
