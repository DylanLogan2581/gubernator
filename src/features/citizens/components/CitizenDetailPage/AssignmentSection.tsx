import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  depositInstancesBySettlementQueryOptions,
  type DepositInstance,
} from "@/features/deposits";
import {
  managedPopulationInstancesBySettlementQueryOptions,
  type ManagedPopulationInstance,
} from "@/features/managed-populations";
import {
  tradeRoutesForSettlementQueryOptions,
  type TradeRoute,
} from "@/features/trade";
import { getErrorDescription } from "@/lib/errorUtils";

import { currentAssignmentForCitizenQueryOptions } from "../../queries/citizenAssignmentsQueries";

import { Readout } from "./Shared";

import type { CitizenAssignment } from "../../types/citizenAssignmentTypes";
import type { CitizenAssignmentType } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenAssignmentSection({
  citizenId,
  settlementId,
}: {
  readonly citizenId: string;
  readonly settlementId: string | null;
}): JSX.Element {
  const effectiveSettlementId = settlementId ?? "";
  const hasSettlement = settlementId !== null;

  const assignmentQuery = useQuery(
    currentAssignmentForCitizenQueryOptions(citizenId),
  );
  const depositsQuery = useQuery({
    ...depositInstancesBySettlementQueryOptions(effectiveSettlementId),
    enabled: hasSettlement,
  });
  const populationsQuery = useQuery({
    ...managedPopulationInstancesBySettlementQueryOptions(
      effectiveSettlementId,
    ),
    enabled: hasSettlement,
  });
  const tradeRoutesQuery = useQuery({
    ...tradeRoutesForSettlementQueryOptions(effectiveSettlementId),
    enabled: hasSettlement,
  });

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
        <CitizenAssignmentSummary
          assignment={assignmentQuery.data}
          deposits={depositsQuery.data ?? []}
          populations={populationsQuery.data ?? []}
          tradeRoutes={tradeRoutesQuery.data ?? []}
        />
      )}
    </section>
  );
}

function CitizenAssignmentSummary({
  assignment,
  deposits,
  populations,
  tradeRoutes,
}: {
  readonly assignment: CitizenAssignment | null;
  readonly deposits: readonly DepositInstance[];
  readonly populations: readonly ManagedPopulationInstance[];
  readonly tradeRoutes: readonly TradeRoute[];
}): JSX.Element {
  if (assignment === null) {
    return (
      <p className="text-sm italic text-muted-foreground">
        This citizen has no current assignment.
      </p>
    );
  }

  const depositMap = new Map(deposits.map((d) => [d.id, d]));
  const populationMap = new Map(populations.map((p) => [p.id, p]));
  const tradeRouteMap = new Map(tradeRoutes.map((r) => [r.id, r]));

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
      <Readout
        label="Target"
        value={assignmentTargetLabel(
          assignment,
          depositMap,
          populationMap,
          tradeRouteMap,
        )}
        mono
      />
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

function assignmentTargetLabel(
  assignment: CitizenAssignment,
  depositMap: ReadonlyMap<string, DepositInstance>,
  populationMap: ReadonlyMap<string, ManagedPopulationInstance>,
  tradeRouteMap: ReadonlyMap<string, TradeRoute>,
): string | null {
  switch (assignment.assignmentType) {
    case "standard_job":
      return assignment.jobId === null ? null : `Job #${assignment.jobId}`;
    case "construction_project":
      return assignment.constructionProjectId === null
        ? null
        : `Project #${assignment.constructionProjectId}`;
    case "deposit": {
      if (assignment.depositInstanceId === null) return null;
      const deposit = depositMap.get(assignment.depositInstanceId);
      return deposit !== undefined
        ? deposit.name
        : `Deposit #${assignment.depositInstanceId}`;
    }
    case "husbandry":
    case "culling": {
      if (assignment.managedPopulationInstanceId === null) return null;
      const pop = populationMap.get(assignment.managedPopulationInstanceId);
      if (pop === undefined) {
        return `Population #${assignment.managedPopulationInstanceId}`;
      }
      const jobName =
        assignment.assignmentType === "husbandry"
          ? pop.husbandryJobName
          : pop.cullingJobName;
      return `${pop.name} — ${jobName}`;
    }
    case "trade_route": {
      if (assignment.tradeRouteId === null) return null;
      const route = tradeRouteMap.get(assignment.tradeRouteId);
      if (route === undefined) {
        return `Trade route #${assignment.tradeRouteId}`;
      }
      const end = assignment.tradeRouteEnd ?? "";
      return `${route.resourceName}: ${route.originSettlementName} → ${route.destinationSettlementName} (${end})`;
    }
  }
}
