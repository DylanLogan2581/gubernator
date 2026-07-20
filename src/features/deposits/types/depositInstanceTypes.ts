export type DepositInstanceStatus = "active" | "depleted" | "removed";

export type DepositInstanceTier = {
  readonly id: string;
  readonly jobId: string;
  readonly jobName: string;
  readonly outputUnitsPerWorker: number;
  readonly tierNumber: number;
};

export type DepositInstanceResource = {
  readonly createdAt: string;
  readonly depositInstanceId: string;
  readonly id: string;
  readonly initialQuantity: number;
  readonly remainingQuantity: number;
  readonly resourceId: string;
  readonly resourceName: string;
  readonly updatedAt: string;
};

export type DepositInstance = {
  readonly createdAt: string;
  readonly depositTypeIcon: string | null;
  readonly depositTypeIconColor: number | null;
  readonly depositTypeId: string;
  readonly depositTypeName: string;
  readonly discoveredByEventId: string | null;
  readonly id: string;
  readonly maxWorkers: number | null;
  readonly name: string;
  readonly resources: readonly DepositInstanceResource[];
  readonly settlementId: string;
  readonly status: DepositInstanceStatus;
  readonly tiers: readonly DepositInstanceTier[];
  readonly updatedAt: string;
};

export type CreateDepositInstanceResult = {
  readonly depositInstanceId: string;
  readonly settlementId: string;
};

export type SetDepositInstanceMaxWorkersResult = {
  readonly maxWorkers: number | null;
  readonly unassignedCitizenIds: readonly string[];
};

export type RemoveDepositInstanceResult = {
  readonly depositInstanceId: string;
  readonly settlementId: string;
};

export type SetDepositInstanceResourceQuantitiesResult = {
  readonly depositInstanceId: string;
  readonly depositInstanceResourceId: string;
  readonly initialQuantity: number;
  readonly remainingQuantity: number;
  readonly settlementId: string;
};

export type RestoreDepositInstanceResult = {
  readonly depositInstanceId: string;
  readonly settlementId: string;
};

export type HardDeleteDepositInstanceResult = {
  readonly depositInstanceId: string;
  readonly settlementId: string;
};
