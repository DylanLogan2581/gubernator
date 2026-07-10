import type { Json } from "@/types/database";

import type {
  Resource,
  ResourceCategoryRef,
  ResourceChangeMode,
} from "../types/resourceTypes";

export type ResourceCategoryRefRow = {
  readonly color: string;
  readonly icon: string | null;
  readonly id: string;
  readonly name: string;
};

export type ResourceRow = {
  readonly base_stockpile_cap: number;
  readonly category_id: string | null;
  readonly change_amount: number;
  readonly change_mode: ResourceChangeMode;
  readonly created_at: string;
  readonly icon: string | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: Json;
  readonly name: string;
  readonly resource_categories: ResourceCategoryRefRow | null;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const RESOURCE_SELECT =
  "id,world_id,name,slug,icon,base_stockpile_cap,change_mode,change_amount,is_system_resource,is_trashed,last_cleanup_summary_json,created_at,updated_at,category_id,resource_categories(id,name,icon,color)";

function toResourceCategoryRef(
  row: ResourceCategoryRefRow | null | undefined,
): ResourceCategoryRef | null {
  if (row === null || row === undefined) return null;
  return {
    color: row.color,
    icon: row.icon,
    id: row.id,
    name: row.name,
  };
}

export function toResource(row: ResourceRow): Resource {
  return {
    baseStockpileCap: row.base_stockpile_cap,
    category: toResourceCategoryRef(row.resource_categories),
    categoryId: row.category_id,
    changeAmount: row.change_amount,
    changeMode: row.change_mode,
    createdAt: row.created_at,
    icon: row.icon,
    id: row.id,
    isTrashed: row.is_trashed,
    isSystemResource: row.is_system_resource,
    lastCleanupSummaryJson: row.last_cleanup_summary_json,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
