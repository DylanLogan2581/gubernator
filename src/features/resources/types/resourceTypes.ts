import type { Json } from "@/types/database";

export type Resource = {
  readonly baseStockpileCap: number;
  readonly createdAt: string;
  readonly id: string;
  readonly isTrashed: boolean;
  readonly isSystemResource: boolean;
  readonly lastCleanupSummaryJson: Json;
  readonly name: string;
  readonly slug: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type ResourceCleanupSummary = {
  readonly buildingTierConstructionCostsCleaned: number;
  readonly buildingTierEffectsCleaned: number;
  readonly buildingTierUpkeepCostsCleaned: number;
  readonly depositTypesWorkerInputsCleaned: number;
  readonly jobDefinitionsInputsCleaned: number;
  readonly jobDefinitionsOutputsCleaned: number;
  readonly managedPopulationCullingOutputsCleaned: number;
  readonly managedPopulationMaintenanceCleaned: number;
};

export type SoftDeleteResourceResult = {
  readonly cleanupSummary: ResourceCleanupSummary;
  readonly resourceId: string;
  readonly worldId: string;
};

export type RestoreResourceResult = {
  readonly resourceId: string;
  readonly worldId: string;
};

export type HardDeleteResourceResult = {
  readonly resourceId: string;
  readonly worldId: string;
};
