import type { EducationLevel } from "../types/educationLevelTypes";

export type EducationLevelRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly rank: number;
  readonly updated_at: string;
  readonly world_id: string;
};

export const EDUCATION_LEVEL_SELECT =
  "id,world_id,name,description,rank,created_at,updated_at";

export function toEducationLevel(row: EducationLevelRow): EducationLevel {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    rank: row.rank,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
