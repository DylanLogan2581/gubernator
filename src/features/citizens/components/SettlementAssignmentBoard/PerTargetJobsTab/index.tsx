import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { depositInstancesBySettlementQueryOptions } from "@/features/deposits";
import { managedPopulationInstancesBySettlementQueryOptions } from "@/features/managed-populations";
import { tradeRoutesForSettlementQueryOptions } from "@/features/trade";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizensInSettlementQueryOptions } from "../../../queries/citizensQueries";
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
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );

  if (
    assignmentsQuery.isPending ||
    depositsQuery.isPending ||
    populationsQuery.isPending ||
    tradeRoutesQuery.isPending ||
    citizensQuery.isPending
  ) {
    return <LoadingState label="Loading per-target assignments…" />;
  }

  const firstError =
    assignmentsQuery.error ??
    depositsQuery.error ??
    populationsQuery.error ??
    tradeRoutesQuery.error ??
    citizensQuery.error;
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
  const citizens = citizensQuery.data ?? [];

  const assignedByDeposit = new Map<string, string[]>();
  const assignedByHusbandry = new Map<string, string[]>();
  const assignedByCulling = new Map<string, string[]>();
  const assignedByTradeRouteEnd = new Map<string, string[]>();

  for (const a of assignments) {
    if (a.assignmentType === "deposit" && a.depositInstance !== null) {
      const id = a.depositInstance.id;
      const ids = assignedByDeposit.get(id) ?? [];
      ids.push(a.citizenId);
      assignedByDeposit.set(id, ids);
    } else if (
      a.assignmentType === "husbandry" &&
      a.managedPopulationInstance !== null
    ) {
      const id = a.managedPopulationInstance.id;
      const ids = assignedByHusbandry.get(id) ?? [];
      ids.push(a.citizenId);
      assignedByHusbandry.set(id, ids);
    } else if (
      a.assignmentType === "culling" &&
      a.managedPopulationInstance !== null
    ) {
      const id = a.managedPopulationInstance.id;
      const ids = assignedByCulling.get(id) ?? [];
      ids.push(a.citizenId);
      assignedByCulling.set(id, ids);
    } else if (
      a.assignmentType === "trade_route" &&
      a.tradeRoute !== null &&
      a.tradeRouteEnd !== null
    ) {
      const key = `${a.tradeRoute.id}:${a.tradeRouteEnd}`;
      const ids = assignedByTradeRouteEnd.get(key) ?? [];
      ids.push(a.citizenId);
      assignedByTradeRouteEnd.set(key, ids);
    }
  }

  const citizenMap = new Map(citizens.map((c) => [c.id, c]));
  const aliveCitizens = citizens.filter(
    (c) => c.status === "alive" && c.citizenType === "npc",
  );

  return (
    <div className="grid gap-4">
      <DepositsSection
        aliveCitizens={aliveCitizens}
        assignedByDeposit={assignedByDeposit}
        canEdit={canEdit}
        citizenMap={citizenMap}
        deposits={deposits}
        queryClient={queryClient}
        settlementId={settlementId}
      />
      <HusbandrySection
        aliveCitizens={aliveCitizens}
        assignedByHusbandry={assignedByHusbandry}
        canEdit={canEdit}
        citizenMap={citizenMap}
        populations={populations}
        queryClient={queryClient}
        settlementId={settlementId}
      />
      <CullingSection
        aliveCitizens={aliveCitizens}
        assignedByCulling={assignedByCulling}
        canEdit={canEdit}
        citizenMap={citizenMap}
        populations={populations}
        queryClient={queryClient}
        settlementId={settlementId}
      />
      <TradeRoutesSection
        aliveCitizens={aliveCitizens}
        assignedByTradeRouteEnd={assignedByTradeRouteEnd}
        canEdit={canEdit}
        citizenMap={citizenMap}
        queryClient={queryClient}
        settlementId={settlementId}
        tradeRoutes={tradeRoutes}
      />
    </div>
  );
}
