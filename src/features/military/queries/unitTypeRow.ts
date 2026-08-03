import type { TierCostEntry } from "@/features/buildings";

import type { UnitType } from "../types/unitTypeTypes";

export type UnitTypeCostEntryRow = {
  readonly amount: number;
  readonly resource_id: string;
};

export type UnitTypeRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly desertion_rate: number;
  readonly id: string;
  readonly name: string;
  readonly recruitment_costs_json: readonly UnitTypeCostEntryRow[];
  readonly required_building_blueprint_id: string | null;
  readonly required_building_tier_number: number | null;
  readonly required_education_level_id: string | null;
  readonly soldiers_per_unit: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly UnitTypeCostEntryRow[];
  readonly world_id: string;
};

export const UNIT_TYPE_SELECT = [
  "id,world_id,name,description,soldiers_per_unit,desertion_rate",
  "required_education_level_id,required_building_blueprint_id,required_building_tier_number",
  "recruitment_costs_json,upkeep_costs_json,created_at,updated_at",
].join(",");

function toCostEntry(row: UnitTypeCostEntryRow): TierCostEntry {
  return {
    amount: row.amount,
    resourceId: row.resource_id,
  };
}

export function toUnitType(row: UnitTypeRow): UnitType {
  return {
    createdAt: row.created_at,
    description: row.description,
    desertionRate: row.desertion_rate,
    id: row.id,
    name: row.name,
    recruitmentCostsJson: row.recruitment_costs_json.map(toCostEntry),
    requiredBuildingBlueprintId: row.required_building_blueprint_id,
    requiredBuildingTierNumber: row.required_building_tier_number,
    requiredEducationLevelId: row.required_education_level_id,
    soldiersPerUnit: row.soldiers_per_unit,
    updatedAt: row.updated_at,
    upkeepCostsJson: row.upkeep_costs_json.map(toCostEntry),
    worldId: row.world_id,
  };
}
