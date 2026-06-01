import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

import type { WorldPermissionContext } from "../types/worldTypes";

export const worldQueryKeys = {
  all: authStateQueryCacheKeys.worldsAll,
  accessibleWorlds: (accessContext: WorldPermissionContext) =>
    [
      ...worldQueryKeys.all,
      "accessible",
      accessContext.userId,
      accessContext.isActiveUser,
      accessContext.isSuperAdmin,
      ...accessContext.worldAdminWorldIds,
      ...accessContext.playerCharacterWorldIds,
    ] as const,
  byId: (worldId: string, accessContext: WorldPermissionContext) =>
    [
      ...worldQueryKeys.all,
      "by-id",
      worldId,
      accessContext.userId,
      accessContext.isActiveUser,
      accessContext.isSuperAdmin,
      ...accessContext.worldAdminWorldIds,
      ...accessContext.playerCharacterWorldIds,
    ] as const,
  namingConfig: (worldId: string) =>
    [...worldQueryKeys.all, "naming-config", worldId] as const,
  npcFlavorConfig: (worldId: string) =>
    [...worldQueryKeys.all, "npc-flavor-config", worldId] as const,
  populationRules: (worldId: string) =>
    [...worldQueryKeys.all, "population-rules", worldId] as const,
} as const;
