import type {
  AccessContext,
  WorldAccessTarget,
} from "../types/accessContextTypes";

type CreateAccessContextInput = {
  readonly isActiveUser?: boolean;
  readonly isSuperAdmin: boolean;
  readonly userId: string | null;
  readonly worldAdminWorldIds: readonly string[];
};

export function createAccessContext({
  isActiveUser,
  isSuperAdmin,
  userId,
  worldAdminWorldIds,
}: CreateAccessContextInput): AccessContext {
  const hasActiveAppUser = isActiveUser ?? userId !== null;
  const effectiveIsSuperAdmin = hasActiveAppUser && isSuperAdmin;
  const effectiveWorldAdminWorldIds = hasActiveAppUser
    ? worldAdminWorldIds
    : [];
  const worldAdminWorldIdSet = new Set(effectiveWorldAdminWorldIds);

  function canAdminWorld(world: WorldAccessTarget): boolean {
    if (!hasActiveAppUser) {
      return false;
    }

    return (
      effectiveIsSuperAdmin ||
      worldAdminWorldIdSet.has(world.id) ||
      (userId !== null && world.ownerId === userId)
    );
  }

  function canManageWorld(world: WorldAccessTarget): boolean {
    return canAdminWorld(world);
  }

  function canAccessWorld(world: WorldAccessTarget): boolean {
    if (!hasActiveAppUser) {
      return false;
    }

    return canManageWorld(world) || world.visibility === "public";
  }

  return {
    canAccessWorld,
    canAdminWorld,
    canManageWorld,
    isActiveUser: hasActiveAppUser,
    isAuthenticated: userId !== null,
    isSuperAdmin: effectiveIsSuperAdmin,
    userId,
    worldAdminWorldIds: effectiveWorldAdminWorldIds,
  };
}
