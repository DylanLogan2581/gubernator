export type TierCostEntry = {
  readonly amount: number;
  readonly resourceId: string;
};

export type TierEffect =
  | {
      readonly amount: number;
      readonly jobId: string;
      readonly type: "job_capacity_increase";
    }
  | {
      readonly amount: number;
      readonly resourceId: string;
      readonly type: "passive_resource_production";
    }
  | {
      readonly amount: number;
      readonly resourceId: string;
      readonly type: "resource_storage_increase";
    }
  | {
      readonly amount: number;
      readonly type: "population_cap_increase";
    };

export type BuildingBlueprint = {
  readonly createdAt: string;
  readonly description: string | null;
  readonly gracePeriodTurns: number;
  readonly id: string;
  readonly isActive: boolean;
  readonly maxInstancesPerSettlement: number | null;
  readonly name: string;
  readonly slug: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type BuildingBlueprintTier = {
  readonly buildingBlueprintId: string;
  readonly constructionCostsJson: readonly TierCostEntry[];
  readonly createdAt: string;
  readonly effectsJson: readonly TierEffect[];
  readonly id: string;
  readonly tierNumber: number;
  readonly updatedAt: string;
  readonly upkeepCostsJson: readonly TierCostEntry[];
  readonly workerTurnsRequired: number;
};

export type SoftDeleteBlueprintResult = {
  readonly blueprintId: string;
  readonly worldId: string;
};

export type RestoreBlueprintResult = {
  readonly blueprintId: string;
  readonly worldId: string;
};

export type HardDeleteBlueprintResult = {
  readonly blueprintId: string;
  readonly worldId: string;
};

export type DeleteTierResult = {
  readonly blueprintId: string;
  readonly tierId: string;
};
