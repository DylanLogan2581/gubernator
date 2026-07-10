export type JobType =
  | "construction"
  | "culling"
  | "deposit"
  | "husbandry"
  | "standard"
  | "teacher"
  | "trader";

export type JobIoEntry = {
  readonly amountPerWorker: number;
  readonly notes?: string;
  readonly resourceId: string;
};

export type JobDefinition = {
  readonly baseCapacity: number | null;
  readonly createdAt: string;
  readonly hasActiveReferences: boolean;
  readonly icon: string | null;
  readonly id: string;
  readonly inputsJson: readonly JobIoEntry[];
  readonly isTrashed: boolean;
  readonly jobType: JobType;
  readonly linkedDepositTypeId: string | null;
  readonly linkedManagedPopulationTypeId: string | null;
  readonly name: string;
  readonly outputsJson: readonly JobIoEntry[];
  // Minimum education level required to fill this job, null = no requirement.
  // Qualification rule (enforced by a later issue): citizen qualifies iff
  // their education level rank >= this level's rank; uneducated (null)
  // citizens qualify only when this is null.
  readonly requiredEducationLevelId: string | null;
  readonly slug: string;
  readonly traderCapacityPerWorker: number | null;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type SoftDeleteJobResult = {
  readonly jobId: string;
  readonly worldId: string;
};

export type RestoreJobResult = {
  readonly jobId: string;
  readonly worldId: string;
};

export type HardDeleteJobResult = {
  readonly jobId: string;
  readonly worldId: string;
};
