import type { TierCostEntry } from "@/features/buildings";

export type UnitType = {
  readonly createdAt: string;
  readonly description: string | null;
  readonly desertionRate: number;
  readonly id: string;
  readonly name: string;
  readonly recruitmentCostsJson: readonly TierCostEntry[];
  readonly requiredBuildingBlueprintId: string | null;
  readonly requiredBuildingTierNumber: number | null;
  readonly requiredEducationLevelId: string | null;
  readonly soldiersPerUnit: number;
  readonly updatedAt: string;
  readonly upkeepCostsJson: readonly TierCostEntry[];
  readonly worldId: string;
};

export type DeleteUnitTypeResult = {
  readonly unitTypeId: string;
  readonly worldId: string;
};
