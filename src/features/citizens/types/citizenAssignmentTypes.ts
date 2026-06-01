import type { CitizenAssignmentType } from "./citizenTypes";

export type CitizenAssignment = {
  readonly assignedOnTurnNumber: number;
  readonly assignmentType: CitizenAssignmentType;
  readonly citizenId: string;
  readonly constructionProjectId: string | null;
  readonly createdAt: string;
  readonly depositInstanceId: string | null;
  readonly jobId: string | null;
  readonly managedPopulationInstanceId: string | null;
  readonly tradeRouteEnd: string | null;
  readonly tradeRouteId: string | null;
  readonly updatedAt: string;
};
