import type { ResourceCategory } from "../types/resourceCategoryTypes";

export type ResourceCategoryRow = {
  readonly color: string;
  readonly created_at: string;
  readonly icon: string | null;
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly updated_at: string;
  readonly world_id: string;
};

export const RESOURCE_CATEGORY_SELECT =
  "id,world_id,name,icon,color,sort_order,created_at,updated_at";

export function toResourceCategory(row: ResourceCategoryRow): ResourceCategory {
  return {
    color: row.color,
    createdAt: row.created_at,
    icon: row.icon,
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
