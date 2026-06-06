import type { WorldAccessTarget } from "../types/accessContextTypes";

type WorldAccessRow = {
  readonly id: string;
  readonly visibility: string;
};

export function toWorldAccessTarget(world: WorldAccessRow): WorldAccessTarget {
  return {
    id: world.id,
    visibility: world.visibility,
  };
}
