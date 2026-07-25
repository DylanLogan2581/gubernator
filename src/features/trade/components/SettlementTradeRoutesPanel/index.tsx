import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { MasterDetailLayout } from "@/components/shared/MasterDetailLayout";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { useWorldTransitionOutcome } from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";
import { parseTradeRouteResumedPayload } from "@/shared/simulation";

import { tradeRoutesForSettlementQueryOptions } from "../../queries/tradeRoutesQueries";

import { ProposeTradeRouteDialog } from "./ProposeTradeRouteDialog";
import { TradeRouteDetailPanel } from "./TradeRouteDetailPanel";
import { ACTIVE_STATUSES, CANCELLED_STATUSES } from "./TradeRouteHelpers";
import { TradeRoutesDirection } from "./TradeRouteTable";

type SettlementTradeRoutesPanelProps = {
  readonly canManage: boolean;
  readonly canManageNation: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementTradeRoutesPanel({
  canManage,
  canManageNation,
  isArchived,
  settlementId,
  worldId,
}: SettlementTradeRoutesPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();
  const [showProposeDialog, setShowProposeDialog] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const routesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const latestOutcome = useWorldTransitionOutcome(worldId);

  const canManageRoutes = !isArchived && canManage;

  const resumedRouteIds = new Set<string>();
  if (latestOutcome !== null) {
    for (const entry of latestOutcome.logEntries) {
      if (entry.logCategory === "trade_route.resumed") {
        const parsed = parseTradeRouteResumedPayload(entry.payloadJsonb);
        if (parsed !== null) {
          resumedRouteIds.add(parsed.tradeRouteId);
        }
      }
    }
  }

  const traderCountByRoute = new Map<string, number>();
  if (assignmentsQuery.data !== undefined) {
    for (const a of assignmentsQuery.data) {
      if (a.assignmentType === "trade_route" && a.tradeRoute !== null) {
        const id = a.tradeRoute.id;
        traderCountByRoute.set(id, (traderCountByRoute.get(id) ?? 0) + 1);
      }
    }
  }

  const allRoutes = routesQuery.data ?? [];
  const activeRoutes = allRoutes.filter((r) => ACTIVE_STATUSES.has(r.status));
  const cancelledRoutes = allRoutes.filter((r) =>
    CANCELLED_STATUSES.has(r.status),
  );
  const visibleRoutes = showCancelled ? cancelledRoutes : activeRoutes;

  const outgoing = visibleRoutes.filter(
    (r) => r.originSettlementId === settlementId,
  );
  const incoming = visibleRoutes.filter(
    (r) => r.destinationSettlementId === settlementId,
  );

  const selectedRoute = allRoutes.find((r) => r.id === selectedRouteId) ?? null;
  const selectedRouteSide: "destination" | "origin" | null =
    selectedRoute === null
      ? null
      : selectedRoute.originSettlementId === settlementId
        ? "origin"
        : "destination";

  return (
    <section
      aria-labelledby="settlement-trade-routes-heading"
      className="grid min-w-0 grid-cols-1 gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="settlement-trade-routes-heading"
          className="text-base font-medium"
        >
          Trade Routes
        </h2>
        <div className="flex items-center gap-2">
          {canManageRoutes && !routesQuery.isPending && !showCancelled ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setShowProposeDialog(true);
              }}
            >
              <Plus aria-hidden="true" />
              Propose trade route
            </Button>
          ) : null}
          {!routesQuery.isPending && !routesQuery.isError ? (
            <Button
              aria-label={showCancelled ? "Hide cancelled" : "Show cancelled"}
              aria-pressed={showCancelled}
              size="icon-sm"
              title={showCancelled ? "Hide cancelled" : "Show cancelled"}
              type="button"
              variant={showCancelled ? "secondary" : "ghost"}
              onClick={() => {
                setShowCancelled((v) => !v);
              }}
            >
              <Eye aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {showProposeDialog ? (
        <ProposeTradeRouteDialog
          activeCharacterId={activeCharacter?.id ?? null}
          canManageNation={canManageNation}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setShowProposeDialog(false);
          }}
        />
      ) : null}

      <div>
        {routesQuery.isPending ? (
          <TableSkeleton columnCount={5} rowCount={5} />
        ) : routesQuery.isError ? (
          <ErrorState
            title="Trade routes could not be loaded"
            description={getErrorDescription(routesQuery.error)}
          />
        ) : outgoing.length === 0 && incoming.length === 0 ? (
          <EmptyState
            title={
              showCancelled ? "No cancelled trade routes" : "No trade routes"
            }
            description={
              showCancelled
                ? "This settlement has no cancelled or replaced trade routes."
                : "This settlement has no active or proposed trade routes."
            }
          />
        ) : (
          <MasterDetailLayout
            list={
              <div className="grid gap-4">
                <TradeRoutesDirection
                  activeCharacterId={activeCharacter?.id ?? null}
                  canManageRoutes={showCancelled ? false : canManageRoutes}
                  label="Outgoing"
                  queryClient={queryClient}
                  resumedRouteIds={resumedRouteIds}
                  routes={outgoing}
                  selectedRouteId={selectedRouteId}
                  settlementId={settlementId}
                  side="origin"
                  traderCountByRoute={traderCountByRoute}
                  worldId={worldId}
                  onSelectRoute={setSelectedRouteId}
                />
                <TradeRoutesDirection
                  activeCharacterId={activeCharacter?.id ?? null}
                  canManageRoutes={showCancelled ? false : canManageRoutes}
                  label="Incoming"
                  queryClient={queryClient}
                  resumedRouteIds={resumedRouteIds}
                  routes={incoming}
                  selectedRouteId={selectedRouteId}
                  settlementId={settlementId}
                  side="destination"
                  traderCountByRoute={traderCountByRoute}
                  worldId={worldId}
                  onSelectRoute={setSelectedRouteId}
                />
              </div>
            }
            detail={
              selectedRoute === null || selectedRouteSide === null ? null : (
                <TradeRouteDetailPanel
                  route={selectedRoute}
                  side={selectedRouteSide}
                  traderCount={traderCountByRoute.get(selectedRoute.id) ?? 0}
                />
              )
            }
            detailTitle={
              selectedRoute === null || selectedRouteSide === null
                ? ""
                : selectedRouteSide === "origin"
                  ? selectedRoute.destinationSettlementName
                  : selectedRoute.originSettlementName
            }
            onCloseDetail={() => {
              setSelectedRouteId(null);
            }}
          />
        )}
      </div>
    </section>
  );
}
