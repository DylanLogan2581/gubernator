import type {
  AccessContext,
  WorldAccessTarget,
} from "../types/accessContextTypes";

type CreateAccessContextInput = {
  readonly isSuperAdmin: boolean;
  readonly userId: string | null;
  readonly worldAdminWorldIds: readonly string[];
};

export function createAccessContext({
  isSuperAdmin,
  userId,
  worldAdminWorldIds,
}: CreateAccessContextInput): AccessContext {
  const worldAdminWorldIdSet = new Set(worldAdminWorldIds);

  function canAdminWorld(worldId: string): boolean {
    return isSuperAdmin || worldAdminWorldIdSet.has(worldId);
  }

  function canManageWorld(world: WorldAccessTarget): boolean {
    return (
      isSuperAdmin ||
      worldAdminWorldIdSet.has(world.id) ||
      (userId !== null && world.ownerId === userId)
    );
  }

  function canAccessWorld(world: WorldAccessTarget): boolean {
    return canManageWorld(world) || world.visibility === "public";
  }

  return {
    canAccessWorld,
    canAdminWorld,
    canManageWorld,
    isAuthenticated: userId !== null,
    isSuperAdmin,
    userId,
    worldAdminWorldIds,
  };
}
