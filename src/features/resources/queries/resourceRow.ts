import type { Json } from "@/types/database";

import type { Resource } from "../types/resourceTypes";

export type ResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: Json;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const RESOURCE_SELECT =
  "id,world_id,name,slug,base_stockpile_cap,is_system_resource,is_trashed,last_cleanup_summary_json,created_at,updated_at";

export function toResource(row: ResourceRow): Resource {
  return {
    baseStockpileCap: row.base_stockpile_cap,
    createdAt: row.created_at,
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
