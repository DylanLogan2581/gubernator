import type { WorldPermissionContext } from "../types/worldTypes";

export const worldQueryKeys = {
  all: ["worlds"] as const,
  accessibleWorlds: (accessContext: WorldPermissionContext) =>
    [
      ...worldQueryKeys.all,
      "accessible",
      accessContext.userId,
      accessContext.isSuperAdmin,
      ...accessContext.worldAdminWorldIds,
    ] as const,
} as const;
