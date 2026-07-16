import type { Json } from "@/types/database";

import type {
  Resource,
  ResourceCategoryRef,
  ResourceChangeMode,
} from "../types/resourceTypes";

export type ResourceCategoryRefRow = {
  readonly color: string;
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
  "id,world_id,name,slug,icon,base_stockpile_cap,change_mode,change_amount,is_system_resource,is_trashed,last_cleanup_summary_json,created_at,updated_at,category_id,resource_categories(id,name,color)";

function toResourceCategoryRef(
  row: ResourceCategoryRefRow | null | undefined,
): ResourceCategoryRef | null {
  if (row === null || row === undefined) return null;
  return {
    color: row.color,
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

// resources_directory_view (#1242) flattens resource_categories.name onto
// the row so the config table's category sort can order by it directly --
// ordering an embedded/nested select by referencedTable only reorders the
// embedded payload itself, never the parent (resources) rows.
export type ResourceDirectoryRow = {
  readonly base_stockpile_cap: number;
  readonly category_color: string | null;
  readonly category_id: string | null;
  readonly category_name: string | null;
  readonly change_amount: number;
  readonly change_mode: ResourceChangeMode;
  readonly created_at: string;
  readonly icon: string | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: Json;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const RESOURCE_DIRECTORY_SELECT =
  "id,world_id,name,slug,icon,base_stockpile_cap,change_mode,change_amount,is_system_resource,is_trashed,last_cleanup_summary_json,created_at,updated_at,category_id,category_name,category_color";

export function toResourceFromDirectoryRow(
  row: ResourceDirectoryRow,
): Resource {
  return {
    baseStockpileCap: row.base_stockpile_cap,
    category:
      row.category_id === null
        ? null
        : {
            color: row.category_color ?? "#6b7280",
            id: row.category_id,
            name: row.category_name ?? "",
          },
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
