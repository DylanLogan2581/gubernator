export type WorkerInputEntry = {
  readonly amountPerWorker: number;
  readonly resourceId: string;
};

export type DepositTypeJob = {
  readonly id: string;
  readonly jobId: string;
  readonly outputUnitsPerWorker: number;
  readonly workerInputsJson: readonly WorkerInputEntry[];
};

export type DepositType = {
  readonly createdAt: string;
  readonly hasActiveReferences: boolean;
  readonly icon: string | null;
  readonly iconColor: number | null;
  readonly id: string;
  readonly isTrashed: boolean;
  readonly jobs: readonly DepositTypeJob[];
  readonly name: string;
  readonly slug: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type SoftDeleteDepositTypeResult = {
  readonly depositTypeId: string;
  readonly worldId: string;
};

export type RestoreDepositTypeResult = {
  readonly depositTypeId: string;
  readonly worldId: string;
};

export type HardDeleteDepositTypeResult = {
  readonly depositTypeId: string;
  readonly worldId: string;
};
