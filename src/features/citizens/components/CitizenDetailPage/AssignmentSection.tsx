import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Card } from "@/components/ui/card";
import { getErrorDescription } from "@/lib/errorUtils";

import { currentAssignmentForCitizenQueryOptions } from "../../queries/citizenAssignmentsQueries";

import { Readout } from "./Shared";

import type { CitizenAssignment } from "../../types/citizenAssignmentTypes";
import type { CitizenAssignmentType } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenAssignmentSection({
  citizenId,
}: {
  readonly citizenId: string;
}): JSX.Element {
  const assignmentQuery = useQuery(
    currentAssignmentForCitizenQueryOptions(citizenId),
  );

  return (
    <Card
      aria-labelledby="citizen-assignment-heading"
      className="grid gap-3 p-4"
    >
      <h2 id="citizen-assignment-heading" className="text-base font-medium">
        Assignment
      </h2>
      {assignmentQuery.isPending ? (
        <LoadingState label="Loading assignment…" />
      ) : assignmentQuery.isError ? (
        <ErrorState
          title="Assignment could not be loaded"
          description={getErrorDescription(assignmentQuery.error)}
        />
      ) : (
        <CitizenAssignmentSummary assignment={assignmentQuery.data} />
      )}
    </Card>
  );
}

function CitizenAssignmentSummary({
  assignment,
}: {
  readonly assignment: CitizenAssignment | null;
}): JSX.Element {
  if (assignment === null) {
    return (
      <p className="text-sm italic text-muted-foreground">
        This citizen has no current assignment.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Readout
        label="Type"
        value={assignmentTypeLabel(assignment.assignmentType)}
      />
      <Readout
        label="Assigned on turn"
        value={String(assignment.assignedOnTurnNumber)}
      />
      <Readout label="Target" value={assignmentTargetLabel(assignment)} mono />
    </dl>
  );
}

function assignmentTypeLabel(type: CitizenAssignmentType): string {
  switch (type) {
    case "construction_project":
      return "Construction";
    case "culling":
      return "Culling";
    case "deposit":
      return "Deposit";
    case "husbandry":
      return "Husbandry";
    case "standard_job":
      return "Standard job";
    case "trade_route":
      return "Trade route";
  }
}

function assignmentTargetLabel(assignment: CitizenAssignment): string | null {
  switch (assignment.assignmentType) {
    case "standard_job": {
      return assignment.job?.name ?? null;
    }
    case "construction_project": {
      if (assignment.constructionProject === null) return null;
      return assignment.constructionProject.blueprintName;
    }
    case "deposit": {
      if (assignment.depositInstance === null) return null;
      return `${assignment.depositInstance.name} — ${assignment.depositInstance.depositTypeJobName}`;
    }
    case "husbandry":
    case "culling": {
      if (assignment.managedPopulationInstance === null) return null;
      const jobName =
        assignment.assignmentType === "husbandry"
          ? assignment.managedPopulationInstance.husbandryJobName
          : assignment.managedPopulationInstance.cullingJobName;
      return `${assignment.managedPopulationInstance.name} — ${jobName}`;
    }
    case "trade_route": {
      if (assignment.tradeRoute === null) return null;
      const end = assignment.tradeRouteEnd;
      const resources = assignment.tradeRoute.legs
        .map((leg) => leg.resourceName)
        .join(", ");
      if (end === "origin") {
        return `${resources} → ${assignment.tradeRoute.destinationSettlementName} — Trader (origin)`;
      }
      if (end === "destination") {
        return `${assignment.tradeRoute.originSettlementName} → ${resources} — Trader (destination)`;
      }
      return `${resources}: ${assignment.tradeRoute.originSettlementName} → ${assignment.tradeRoute.destinationSettlementName}`;
    }
  }
}
