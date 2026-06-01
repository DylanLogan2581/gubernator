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
