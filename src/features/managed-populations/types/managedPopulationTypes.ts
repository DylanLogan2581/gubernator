export type PopulationResourceEntry = {
  readonly amountPerNAnimals: number;
  readonly resourceId: string;
};

export type ManagedPopulationType = {
  readonly createdAt: string;
  readonly cullingJobId: string;
  readonly cullingOutputsJson: readonly PopulationResourceEntry[];
  readonly growthRate: number;
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

export type SetManagedPopulationTypeActiveResult = {
  readonly isActive: boolean;
  readonly managedPopulationTypeId: string;
  readonly worldId: string;
};
