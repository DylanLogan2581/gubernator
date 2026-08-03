export type PopulationResourceEntry = {
  readonly amountPerNAnimals: number;
  readonly resourceId: string;
};

export type ManagedPopulationHusbandryJob = {
  readonly id: string;
  readonly jobId: string;
  readonly workersPerNAnimals: number;
};

export type ManagedPopulationCullingJob = {
  readonly id: string;
  readonly jobId: string;
  readonly maxCullPerWorker: number;
};

export type ManagedPopulationType = {
  readonly createdAt: string;
  readonly cullingJobs: readonly ManagedPopulationCullingJob[];
  readonly cullingOutputsJson: readonly PopulationResourceEntry[];
  readonly growthRate: number;
  readonly hasActiveReferences: boolean;
  readonly husbandryJobs: readonly ManagedPopulationHusbandryJob[];
  readonly icon: string | null;
  readonly iconColor: number | null;
  readonly id: string;
  readonly isTrashed: boolean;
  readonly maintenanceRulesJson: readonly PopulationResourceEntry[];
  readonly name: string;
  readonly regularOutputsJson: readonly PopulationResourceEntry[];
  readonly slug: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type SoftDeleteManagedPopulationTypeResult = {
  readonly managedPopulationTypeId: string;
  readonly worldId: string;
};

export type RestoreManagedPopulationTypeResult = {
  readonly managedPopulationTypeId: string;
  readonly worldId: string;
};

export type HardDeleteManagedPopulationTypeResult = {
  readonly managedPopulationTypeId: string;
  readonly worldId: string;
};
