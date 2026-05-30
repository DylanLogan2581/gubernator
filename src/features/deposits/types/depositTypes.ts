export type WorkerInputEntry = {
  readonly amountPerWorker: number;
  readonly resourceId: string;
};

export type DepositType = {
  readonly createdAt: string;
  readonly hasActiveReferences: boolean;
  readonly id: string;
  readonly isActive: boolean;
  readonly jobId: string;
  readonly name: string;
  readonly outputUnitsPerWorker: number;
  readonly slug: string;
  readonly updatedAt: string;
  readonly workerInputsJson: readonly WorkerInputEntry[];
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
