export type WorkerInputEntry = {
  readonly amountPerWorker: number;
  readonly resourceId: string;
};

export type DepositType = {
  readonly createdAt: string;
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

export type SetDepositTypeActiveResult = {
  readonly depositTypeId: string;
  readonly isActive: boolean;
  readonly worldId: string;
};
