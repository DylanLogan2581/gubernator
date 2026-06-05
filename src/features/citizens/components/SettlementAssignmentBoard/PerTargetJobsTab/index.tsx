import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { depositInstancesBySettlementQueryOptions } from "@/features/deposits";
import { managedPopulationInstancesBySettlementQueryOptions } from "@/features/managed-populations";
import { tradeRoutesForSettlementQueryOptions } from "@/features/trade";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizenAggregateStatsForSettlementQueryOptions } from "../../../queries/citizensQueries";
import { settlementTargetAssignmentsQueryOptions } from "../../../queries/settlementTargetAssignmentsQueries";

import { DepositsSection } from "./DepositsSection";
import { CullingSection, HusbandrySection } from "./HusbandryCullingSection";
import { TradeRoutesSection } from "./TradeRoutesSection";

type PerTargetJobsTabProps = {
  readonly canEdit: boolean;
  readonly settlementId: string;
};

export function PerTargetJobsTab({
  canEdit,
  settlementId,
}: PerTargetJobsTabProps): JSX.Element {
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const depositsQuery = useQuery(
    depositInstancesBySettlementQueryOptions(settlementId),
  );
  const populationsQuery = useQuery(
    managedPopulationInstancesBySettlementQueryOptions(settlementId),
  );
  const tradeRoutesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );
  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );

  if (
    assignmentsQuery.isPending ||
    depositsQuery.isPending ||
    populationsQuery.isPending ||
    tradeRoutesQuery.isPending ||
    aggregateQuery.isPending
  ) {
    return <LoadingState label="Loading per-target assignments…" />;
  }

  const firstError =
    assignmentsQuery.error ??
    depositsQuery.error ??
    populationsQuery.error ??
    tradeRoutesQuery.error ??
    aggregateQuery.error;
  if (firstError !== null && firstError !== undefined) {
    return (
      <ErrorState
        title="Per-target assignments could not be loaded"
        description={getErrorDescription(firstError)}
      />
    );
  }

  const assignments = assignmentsQuery.data ?? [];
  const deposits = (depositsQuery.data ?? []).filter(
    (d) => d.status === "active",
  );
  const populations = (populationsQuery.data ?? []).filter(
    (p) => p.status === "active",
  );
  const tradeRoutes = (tradeRoutesQuery.data ?? []).filter(
    (r) => r.status === "active",
  );
  const unassignedNpcCount = aggregateQuery.data?.unassignedNpcCount ?? 0;

  const countByDeposit = new Map<string, number>();
  const countByHusbandry = new Map<string, number>();
  const countByCulling = new Map<string, number>();
  const countByTradeRouteEnd = new Map<string, number>();

  for (const a of assignments) {
    if (a.assignmentType === "deposit" && a.depositInstance !== null) {
      const id = a.depositInstance.id;
      countByDeposit.set(id, (countByDeposit.get(id) ?? 0) + 1);
    } else if (
      a.assignmentType === "husbandry" &&
      a.managedPopulationInstance !== null
    ) {
      const id = a.managedPopulationInstance.id;
      countByHusbandry.set(id, (countByHusbandry.get(id) ?? 0) + 1);
    } else if (
      a.assignmentType === "culling" &&
      a.managedPopulationInstance !== null
    ) {
      const id = a.managedPopulationInstance.id;
      countByCulling.set(id, (countByCulling.get(id) ?? 0) + 1);
    } else if (
      a.assignmentType === "trade_route" &&
      a.tradeRoute !== null &&
      a.tradeRouteEnd !== null
    ) {
      const key = `${a.tradeRoute.id}:${a.tradeRouteEnd}`;
      countByTradeRouteEnd.set(key, (countByTradeRouteEnd.get(key) ?? 0) + 1);
    }
  }

  return (
    <div className="grid gap-4">
      <DepositsSection
        canEdit={canEdit}
        countByDeposit={countByDeposit}
        deposits={deposits}
        queryClient={queryClient}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
      <HusbandrySection
        canEdit={canEdit}
        countByHusbandry={countByHusbandry}
        populations={populations}
        queryClient={queryClient}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
      <CullingSection
        canEdit={canEdit}
        countByCulling={countByCulling}
        populations={populations}
        queryClient={queryClient}
        settlementId={settlementId}
        unassignedNpcCount={unassignedNpcCount}
      />
      <TradeRoutesSection
        canEdit={canEdit}
        countByTradeRouteEnd={countByTradeRouteEnd}
        queryClient={queryClient}
        settlementId={settlementId}
        tradeRoutes={tradeRoutes}
        unassignedNpcCount={unassignedNpcCount}
      />
    </div>
  );
}
