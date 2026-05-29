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
  npcFlavorConfig: (worldId: string) =>
    [...worldQueryKeys.all, "npc-flavor-config", worldId] as const,
} as const;
