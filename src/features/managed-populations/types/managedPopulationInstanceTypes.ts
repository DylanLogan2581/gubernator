export type ManagedPopulationInstanceStatus = "active" | "extinct";

export type ManagedPopulationInstance = {
  readonly configuredCullQuantity: number;
  readonly createdAt: string;
  readonly currentCount: number;
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

export type TransferManagedPopulationCountResult = {
  readonly fromManagedPopulationInstanceId: string;
  readonly settlementId: string;
  readonly toManagedPopulationInstanceId: string;
};
