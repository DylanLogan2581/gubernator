export type PopulationResourceEntry = {
  readonly amountPerNAnimals: number;
  readonly resourceId: string;
};

export type ManagedPopulationType = {
  readonly createdAt: string;
  readonly cullingJobId: string;
  readonly cullingOutputsJson: readonly PopulationResourceEntry[];
  readonly growthRate: number;
  readonly hasActiveReferences: boolean;
  readonly husbandryJobId: string;
  readonly husbandryWorkersPerNAnimals: number;
  readonly id: string;
  readonly isActive: boolean;
  readonly maintenanceRulesJson: readonly PopulationResourceEntry[];
  readonly name: string;
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
