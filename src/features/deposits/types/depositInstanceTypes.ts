export type DepositInstanceStatus = "active" | "depleted" | "removed";

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
  readonly depositTypeId: string;
  readonly depositTypeName: string;
  readonly discoveredByEventId: string | null;
  readonly id: string;
  readonly maxWorkers: number | null;
  readonly name: string;
  readonly resources: readonly DepositInstanceResource[];
  readonly settlementId: string;
  readonly status: DepositInstanceStatus;
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
