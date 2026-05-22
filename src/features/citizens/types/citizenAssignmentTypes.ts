import type { CitizenAssignmentType } from "./citizenTypes";

export type CitizenAssignment = {
  readonly assignedOnTurnNumber: number;
  readonly assignmentType: CitizenAssignmentType;
  readonly citizenId: string;
  readonly constructionProjectId: number | null;
  readonly createdAt: string;
  readonly depositInstanceId: number | null;
  readonly jobId: number | null;
  readonly managedPopulationInstanceId: number | null;
  readonly tradeRouteId: number | null;
  readonly updatedAt: string;
};
