export type SettlementJobCount = {
  readonly capacity: number;
  readonly currentCount: number;
  readonly jobId: string;
  readonly jobName: string;
  readonly jobSlug: string;
  readonly worldId: string;
};

export type BulkStandardJobAssignmentResult = {
  readonly after: number;
  readonly addedCitizenIds: readonly string[];
  readonly before: number;
  readonly removedCitizenIds: readonly string[];
};

export type SettlementConstructionProjectCount = {
  readonly constructionProjectId: string;
  readonly status: string;
  readonly queuePosition: number;
  readonly currentCount: number;
  readonly buildingBlueprintId: string;
  readonly targetTierId: string;
};

export type BulkConstructionAssignmentResult = {
  readonly after: number;
  readonly addedCitizenIds: readonly string[];
  readonly before: number;
  readonly removedCitizenIds: readonly string[];
};

export type PerTargetAssignmentResult = {
  readonly assignedCount: number;
  readonly replacedCount: number;
};

export type PerTargetBulkAssignmentResult = {
  readonly after: number;
  readonly addedCitizenIds: readonly string[];
  readonly before: number;
  readonly removedCitizenIds: readonly string[];
};
