import type { TierEffect } from "./buildingTypes";

export type SettlementBuildingState =
  | "active"
  | "auto_deconstructed"
  | "manually_deconstructed"
  | "suspended";

export type EffectsDigest = {
  readonly jobCapacityIncreases: ReadonlyArray<{
    readonly amount: number;
    readonly jobId: string;
  }>;
  readonly passiveProductions: ReadonlyArray<{
    readonly amount: number;
    readonly resourceId: string;
  }>;
  readonly populationCapIncrease: number;
  readonly storageIncreases: ReadonlyArray<{
    readonly amount: number;
    readonly resourceId: string;
  }>;
};

export type SettlementBuilding = {
  readonly activatedOnTurnNumber: number;
  readonly blueprintName: string;
  readonly buildingBlueprintId: string;
  readonly createdAt: string;
  readonly currentTierId: string;
  readonly deactivatedInTransitionId: string | null;
  readonly effectsDigest: EffectsDigest;
  readonly effectsJson: readonly TierEffect[];
  readonly id: string;
  readonly missedUpkeepCount: number;
  readonly name: string | null;
  readonly settlementId: string;
  readonly sourceProjectId: string | null;
  readonly state: SettlementBuildingState;
  readonly tierNumber: number;
  readonly updatedAt: string;
};

export type AddSettlementBuildingResult = {
  readonly settlementBuildingId: string;
};

export type ManualDeconstructBuildingResult = {
  readonly settlementBuildingId: string;
};

export function computeEffectsDigest(
  effects: readonly TierEffect[],
): EffectsDigest {
  let populationCapIncrease = 0;
  const jobCapacityIncreases: Array<{
    amount: number;
    jobId: string;
  }> = [];
  const passiveProductions: Array<{
    amount: number;
    resourceId: string;
  }> = [];
  const storageIncreases: Array<{
    amount: number;
    resourceId: string;
  }> = [];

  for (const effect of effects) {
    switch (effect.type) {
      case "population_cap_increase":
        populationCapIncrease += effect.amount;
        break;
      case "job_capacity_increase":
        jobCapacityIncreases.push({
          amount: effect.amount,
          jobId: effect.jobId,
        });
        break;
      case "passive_resource_production":
        passiveProductions.push({
          amount: effect.amount,
          resourceId: effect.resourceId,
        });
        break;
      case "resource_storage_increase":
        storageIncreases.push({
          amount: effect.amount,
          resourceId: effect.resourceId,
        });
        break;
    }
  }

  return {
    jobCapacityIncreases,
    passiveProductions,
    populationCapIncrease,
    storageIncreases,
  };
}
