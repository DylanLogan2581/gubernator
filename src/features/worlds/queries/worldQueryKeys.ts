import type { WorldPermissionContext } from "../types/worldTypes";

export const worldQueryKeys = {
  all: ["worlds"] as const,
  accessibleWorlds: (accessContext: WorldPermissionContext) =>
    [
      ...worldQueryKeys.all,
      "accessible",
      accessContext.userId,
      accessContext.isActiveUser,
      accessContext.isSuperAdmin,
      ...accessContext.worldAdminWorldIds,
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
    ] as const,
} as const;
