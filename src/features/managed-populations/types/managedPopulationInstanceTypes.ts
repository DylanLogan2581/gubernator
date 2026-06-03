export type ManagedPopulationInstanceStatus = "active" | "extinct";

export type ManagedPopulationInstance = {
  readonly configuredCullQuantity: number;
  readonly createdAt: string;
  readonly cullingJobName: string;
  readonly currentCount: number;
  readonly husbandryJobName: string;
  readonly id: string;
  readonly managedPopulationTypeId: string;
  readonly managedPopulationTypeName: string;
  readonly name: string;
  readonly settlementId: string;
  readonly status: ManagedPopulationInstanceStatus;
  readonly updatedAt: string;
};

export type CreateManagedPopulationInstanceResult = {
  readonly managedPopulationInstanceId: string;
  readonly settlementId: string;
};

export type SetConfiguredCullQuantityResult = {
  readonly managedPopulationInstanceId: string;
  readonly settlementId: string;
};

export type RemoveManagedPopulationInstanceResult = {
  readonly managedPopulationInstanceId: string;
  readonly settlementId: string;
};
