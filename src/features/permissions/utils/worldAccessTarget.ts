import type { WorldAccessTarget } from "../types/accessContextTypes";

type WorldAccessRow = {
  readonly id: string;
  readonly owner_id: string;
  readonly visibility: string;
};

export function toWorldAccessTarget(world: WorldAccessRow): WorldAccessTarget {
  return {
    id: world.id,
    ownerId: world.owner_id,
    visibility: world.visibility,
  };
}
