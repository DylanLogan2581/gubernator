import type { CitizenAssignmentType } from "./citizenTypes";

export type CitizenAssignment = {
  readonly assignedOnTurnNumber: number;
  readonly assignmentType: CitizenAssignmentType;
  readonly citizenId: string;
  readonly constructionProject: {
    readonly blueprintName: string;
    readonly id: string;
    readonly tierNumber: number;
  } | null;
  readonly createdAt: string;
  readonly depositInstance: {
    readonly depositTypeJobName: string;
    readonly depositTypeName: string;
    readonly id: string;
    readonly name: string;
  } | null;
  readonly job: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly managedPopulationInstance: {
    readonly cullingJobName: string;
    readonly husbandryJobName: string;
    readonly id: string;
    readonly name: string;
  } | null;
  readonly tradeRoute: {
    readonly destinationSettlementName: string;
    readonly id: string;
    readonly originSettlementName: string;
    readonly resourceName: string;
  } | null;
  readonly tradeRouteEnd: string | null;
  readonly updatedAt: string;
};
