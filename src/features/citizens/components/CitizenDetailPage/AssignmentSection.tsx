import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
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
    <section
      aria-labelledby="citizen-assignment-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
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
    </section>
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
    case "standard_job":
      return assignment.jobId === null ? null : `Job #${assignment.jobId}`;
    case "construction_project":
      return assignment.constructionProjectId === null
        ? null
        : `Project #${assignment.constructionProjectId}`;
    case "deposit":
      return assignment.depositInstanceId === null
        ? null
        : `Deposit #${assignment.depositInstanceId}`;
    case "husbandry":
    case "culling":
      return assignment.managedPopulationInstanceId === null
        ? null
        : `Population #${assignment.managedPopulationInstanceId}`;
    case "trade_route":
      return assignment.tradeRouteId === null
        ? null
        : `Trade route #${assignment.tradeRouteId}`;
  }
}
