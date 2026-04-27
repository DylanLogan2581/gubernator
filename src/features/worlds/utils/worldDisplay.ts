import type { Tables } from "@/types/database";

import type {
  AccessibleWorld,
  WorldPermissionContext,
} from "../types/worldTypes";

type WorldRow = Pick<
  Tables<"worlds">,
  | "archived_at"
  | "created_at"
  | "current_turn_number"
  | "id"
  | "name"
  | "owner_id"
  | "status"
  | "updated_at"
  | "visibility"
>;

export function toAccessibleWorld(
  world: WorldRow,
  accessContext: WorldPermissionContext,
): AccessibleWorld {
  const accessTarget = {
    id: world.id,
    ownerId: world.owner_id,
    visibility: world.visibility,
  };

  return {
    archivedAt: world.archived_at,
    canAccess: accessContext.canAccessWorld(accessTarget),
    canAdmin: accessContext.canAdminWorld(world.id),
    canManage: accessContext.canManageWorld(accessTarget),
    createdAt: world.created_at,
    currentTurnNumber: world.current_turn_number,
    id: world.id,
    isArchived: world.status === "archived",
    isHidden: world.visibility !== "public",
    name: world.name,
    ownerId: world.owner_id,
    slug: createWorldSlug(world.name, world.id),
    status: world.status,
    updatedAt: world.updated_at,
    visibility: world.visibility,
  };
}

export function createWorldSlug(name: string, id: string): string {
  const normalizedName = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
  const normalizedId = id.replaceAll("-", "").slice(0, 8);
  const slugBase = normalizedName === "" ? "world" : normalizedName;

  return `${slugBase}-${normalizedId}`;
}
