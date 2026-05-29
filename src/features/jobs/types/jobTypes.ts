export type JobType =
  | "construction"
  | "culling"
  | "deposit"
  | "husbandry"
  | "standard"
  | "trader";

export type JobIoEntry = {
  readonly amountPerWorker: number;
  readonly notes?: string;
  readonly resourceId: string;
};

export type JobDefinition = {
  readonly baseCapacity: number | null;
  readonly createdAt: string;
  readonly id: string;
  readonly inputsJson: readonly JobIoEntry[];
  readonly isActive: boolean;
  readonly jobType: JobType;
  readonly linkedDepositTypeId: string | null;
  readonly linkedManagedPopulationTypeId: string | null;
  readonly name: string;
  readonly outputsJson: readonly JobIoEntry[];
  readonly slug: string;
  readonly traderCapacityPerWorker: number | null;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type SetJobActiveResult = {
  readonly isActive: boolean;
  readonly jobId: string;
  readonly worldId: string;
};
