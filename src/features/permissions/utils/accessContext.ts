import type {
  AccessContext,
  WorldAccessTarget,
} from "../types/accessContextTypes";

type CreateAccessContextInput = {
  readonly isActiveUser?: boolean;
  readonly isSuperAdmin: boolean;
  readonly userId: string | null;
  readonly worldAdminWorldIds: readonly string[];
  readonly playerCharacterWorldIds?: readonly string[];
};

export function createAccessContext({
  isActiveUser,
  isSuperAdmin,
  userId,
  worldAdminWorldIds,
  playerCharacterWorldIds = [],
}: CreateAccessContextInput): AccessContext {
  const hasActiveAppUser = isActiveUser ?? userId !== null;
  const effectiveIsSuperAdmin = hasActiveAppUser && isSuperAdmin;
  const effectiveWorldAdminWorldIds = hasActiveAppUser
    ? worldAdminWorldIds
    : [];
  const effectivePlayerCharacterWorldIds = hasActiveAppUser
    ? playerCharacterWorldIds
    : [];
  const worldAdminWorldIdSet = new Set(effectiveWorldAdminWorldIds);
  const playerCharacterWorldIdSet = new Set(effectivePlayerCharacterWorldIds);

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

  function canAccessWorld(world: WorldAccessTarget): boolean {
    if (!hasActiveAppUser) {
      return false;
    }

    return (
      canAdminWorld(world) ||
      world.visibility === "public" ||
      playerCharacterWorldIdSet.has(world.id)
    );
  }

  return {
    canAccessWorld,
    canAdminWorld,
    isActiveUser: hasActiveAppUser,
    isAuthenticated: userId !== null,
    isSuperAdmin: effectiveIsSuperAdmin,
    userId,
    worldAdminWorldIds: effectiveWorldAdminWorldIds,
    playerCharacterWorldIds: effectivePlayerCharacterWorldIds,
  };
}
