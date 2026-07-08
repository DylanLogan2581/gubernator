import type { Religion } from "../types/religionTypes";

export type ReligionRow = {
  readonly color: string;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const RELIGION_SELECT =
  "id,world_id,name,description,color,created_at,updated_at";

export function toReligion(row: ReligionRow): Religion {
  return {
    color: row.color,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
