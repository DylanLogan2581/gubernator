export type ConstructionProjectStatus =
  | "cancelled"
  | "complete"
  | "in_progress"
  | "paused"
  | "queued";

export type ConstructionProject = {
  readonly activatedOnTurnNumber: number | null;
  readonly blueprintName: string;
  readonly buildingBlueprintId: string;
  readonly completedInTransitionId: string | null;
  readonly createdAt: string;
  readonly id: string;
  readonly progressWorkerTurns: number;
  readonly queuePosition: number;
  readonly settlementId: string;
  readonly status: ConstructionProjectStatus;
  readonly targetTierId: string;
  readonly tierNumber: number;
  readonly updatedAt: string;
  readonly workerTurnsRequired: number;
};

export type CreateConstructionProjectResult = {
  readonly projectId: string;
  readonly settlementId: string;
};

export type CancelConstructionProjectResult = {
  readonly projectId: string;
  readonly unassignedCitizenCount: number;
};

export type ReorderConstructionProjectsResult = {
  readonly updatedCount: number;
};

export type SetConstructionProjectWorkersResult = {
  readonly after: number;
  readonly addedCitizenIds: readonly string[];
  readonly before: number;
  readonly removedCitizenIds: readonly string[];
};

export type ResumeConstructionProjectResult = {
  readonly projectId: string;
  readonly success: boolean;
};

export type HardDeleteConstructionProjectResult = {
  readonly projectId: string;
  readonly success: boolean;
};
