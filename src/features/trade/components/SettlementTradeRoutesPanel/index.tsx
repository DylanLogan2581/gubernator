import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { latestWorldTransitionOutcomeQueryOptions } from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";
import { parseTradeRouteResumedPayload } from "@/shared/simulation";

import { tradeRoutesForSettlementQueryOptions } from "../../queries/tradeRoutesQueries";

import { ApproveConfirmDialog } from "./ApproveConfirmDialog";
import { CancelConfirmDialog } from "./CancelConfirmDialog";
import { ProposeTradeRouteDialog } from "./ProposeTradeRouteDialog";
import { RejectConfirmDialog } from "./RejectConfirmDialog";
import { ReplaceTradeRouteDialog } from "./ReplaceTradeRouteDialog";

import type {
  TradeRoute,
  TradeRouteApprovalStatus,
  TradeRouteStatus,
} from "../../types/tradeRouteTypes";

type SettlementTradeRoutesPanelProps = {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementTradeRoutesPanel({
  canAdmin,
  isArchived,
  nationId,
  settlementId,
  worldId,
}: SettlementTradeRoutesPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();
  const [showProposeDialog, setShowProposeDialog] = useState(false);

  const routesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
  );
  const latestOutcomeQuery = useQuery(
    latestWorldTransitionOutcomeQueryOptions(worldId),
  );

  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nationId &&
    activeCharacter.status === "alive";
  const isSettlementManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "settlement_manager" &&
    activeCharacter.roleSettlementId === settlementId &&
    activeCharacter.status === "alive";
  const canManageRoutes =
    !isArchived &&
    activeCharacter !== null &&
    (canAdmin || isNationManager || isSettlementManager);

  const resumedRouteIds = new Set<string>();
  if (
    latestOutcomeQuery.data !== null &&
    latestOutcomeQuery.data !== undefined
  ) {
    for (const entry of latestOutcomeQuery.data.logEntries) {
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

  const routes = routesQuery.data ?? [];
  const outgoing = routes.filter((r) => r.originSettlementId === settlementId);
  const incoming = routes.filter(
    (r) => r.destinationSettlementId === settlementId,
  );

  return (
    <section
      aria-labelledby="settlement-trade-routes-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex items-center justify-between">
        <h2
          id="settlement-trade-routes-heading"
          className="text-base font-medium"
        >
          Trade Routes
        </h2>
        {canManageRoutes &&
        !routesQuery.isPending &&
        activeCharacter !== null ? (
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
      </div>
      {showProposeDialog && activeCharacter !== null ? (
        <ProposeTradeRouteDialog
          activeCharacterId={activeCharacter.id}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setShowProposeDialog(false);
          }}
        />
      ) : null}

      {routesQuery.isPending ? (
        <LoadingState label="Loading trade routes…" />
      ) : routesQuery.isError ? (
        <ErrorState
          title="Trade routes could not be loaded"
          description={getErrorDescription(routesQuery.error)}
        />
      ) : outgoing.length === 0 && incoming.length === 0 ? (
        <EmptyState
          title="No trade routes"
          description="This settlement has no active or proposed trade routes."
        />
      ) : (
        <div className="grid gap-4">
          <TradeRoutesDirection
            activeCharacterId={activeCharacter?.id ?? null}
            canManageRoutes={canManageRoutes}
            label="Outgoing"
            queryClient={queryClient}
            resumedRouteIds={resumedRouteIds}
            routes={outgoing}
            settlementId={settlementId}
            side="origin"
            traderCountByRoute={traderCountByRoute}
          />
          <TradeRoutesDirection
            activeCharacterId={activeCharacter?.id ?? null}
            canManageRoutes={canManageRoutes}
            label="Incoming"
            queryClient={queryClient}
            resumedRouteIds={resumedRouteIds}
            routes={incoming}
            settlementId={settlementId}
            side="destination"
            traderCountByRoute={traderCountByRoute}
          />
        </div>
      )}
    </section>
  );
}

function TradeRoutesDirection({
  activeCharacterId,
  canManageRoutes,
  label,
  queryClient,
  resumedRouteIds,
  routes,
  settlementId,
  side,
  traderCountByRoute,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly label: string;
  readonly queryClient: QueryClient;
  readonly resumedRouteIds: ReadonlySet<string>;
  readonly routes: readonly TradeRoute[];
  readonly settlementId: string;
  readonly side: "destination" | "origin";
  readonly traderCountByRoute: ReadonlyMap<string, number>;
}): JSX.Element | null {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (routes.length === 0) return null;

  const panelId = `trade-routes-${label.toLowerCase()}`;

  return (
    <div className="grid gap-1">
      <button
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        className="flex cursor-pointer items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        onClick={() => {
          setIsCollapsed((prev) => !prev);
        }}
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        )}
        {label} ({routes.length})
      </button>
      {!isCollapsed ? (
        <div id={panelId}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium" scope="col">
                  {side === "origin" ? "Destination" : "Origin"}
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Resource
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Qty/turn
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Status
                </th>
                <th className="pb-2 font-medium" scope="col">
                  Origin / Dest
                </th>
                {canManageRoutes ? (
                  <th className="w-48 pb-2" scope="col" aria-label="Actions" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <TradeRouteRow
                  key={route.id}
                  activeCharacterId={activeCharacterId}
                  canManageRoutes={canManageRoutes}
                  isResumedThisTransition={resumedRouteIds.has(route.id)}
                  queryClient={queryClient}
                  route={route}
                  settlementId={settlementId}
                  side={side}
                  traderCount={traderCountByRoute.get(route.id) ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function TradeRouteRow({
  activeCharacterId,
  canManageRoutes,
  isResumedThisTransition,
  queryClient,
  route,
  settlementId,
  side,
  traderCount,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly isResumedThisTransition: boolean;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly settlementId: string;
  readonly side: "destination" | "origin";
  readonly traderCount: number;
}): JSX.Element {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  const counterpart =
    side === "origin"
      ? `${route.destinationSettlementName} (${route.destinationNationName})`
      : `${route.originSettlementName} (${route.originNationName})`;

  const canApproveOrReject =
    canManageRoutes &&
    activeCharacterId !== null &&
    route.status === "proposed";
  const thisSideApproval =
    side === "origin"
      ? route.originApprovalStatus
      : route.destinationApprovalStatus;

  const canCancelStatuses: readonly TradeRouteStatus[] = [
    "proposed",
    "active",
    "paused",
  ];
  const canCancel =
    canManageRoutes &&
    (canCancelStatuses as readonly string[]).includes(route.status);
  const canReplace = canManageRoutes && route.status === "active";

  return (
    <>
      <tr
        id={`trade-route-${route.id}`}
        aria-live={isResumedThisTransition ? "polite" : undefined}
        className={`border-b border-border last:border-0${isResumedThisTransition ? " animate-pulse bg-success [animation-iteration-count:4]" : ""}`}
      >
        <td className="py-2 pr-4 font-medium">{counterpart}</td>
        <td className="py-2 pr-4 text-muted-foreground">
          {route.resourceName}
        </td>
        <td className="py-2 pr-4 tabular-nums">
          {route.quantityPerTransition.toLocaleString()}
        </td>
        <td className="py-2 pr-4">
          <StatusBadge
            pauseReason={route.pauseReasonLastTransition}
            status={route.status}
          />
          {isResumedThisTransition ? (
            <span className="sr-only">resumed this turn</span>
          ) : null}
          {route.replacementForTradeRouteId !== null ? (
            <a
              href={`#trade-route-${route.replacementForTradeRouteId}`}
              className="ml-2 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Earlier route →
            </a>
          ) : null}
        </td>
        <td className="py-2 pr-4">
          <span className="flex items-center gap-1">
            <ApprovalBadge status={route.originApprovalStatus} label="Orig" />
            <span className="text-muted-foreground">/</span>
            <ApprovalBadge
              status={route.destinationApprovalStatus}
              label="Dest"
            />
          </span>
        </td>
        {canManageRoutes ? (
          <td className="w-48 py-2 text-right">
            <div className="flex flex-wrap items-center justify-end gap-1">
              {canApproveOrReject && thisSideApproval === "pending" ? (
                <>
                  <Button
                    aria-label={`Approve trade route with ${counterpart}`}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowApproveDialog(true);
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    aria-label={`Reject trade route with ${counterpart}`}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowRejectDialog(true);
                    }}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              {canReplace ? (
                <Button
                  aria-label={`Replace trade route with ${counterpart}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowReplaceDialog(true);
                  }}
                >
                  Replace
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  aria-label={`Cancel trade route with ${counterpart}`}
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setShowCancelDialog(true);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </td>
        ) : null}
      </tr>
      {showApproveDialog && activeCharacterId !== null ? (
        <ApproveConfirmDialog
          approverCitizenId={activeCharacterId}
          counterpart={counterpart}
          queryClient={queryClient}
          route={route}
          side={side}
          settlementId={settlementId}
          onClose={() => {
            setShowApproveDialog(false);
          }}
        />
      ) : null}
      {showRejectDialog && activeCharacterId !== null ? (
        <RejectConfirmDialog
          rejectorCitizenId={activeCharacterId}
          counterpart={counterpart}
          queryClient={queryClient}
          route={route}
          side={side}
          onClose={() => {
            setShowRejectDialog(false);
          }}
        />
      ) : null}
      {showCancelDialog ? (
        <CancelConfirmDialog
          counterpart={counterpart}
          queryClient={queryClient}
          route={route}
          traderCount={traderCount}
          onClose={() => {
            setShowCancelDialog(false);
          }}
        />
      ) : null}
      {showReplaceDialog && activeCharacterId !== null ? (
        <ReplaceTradeRouteDialog
          activeCharacterId={activeCharacterId}
          counterpart={counterpart}
          queryClient={queryClient}
          route={route}
          onClose={() => {
            setShowReplaceDialog(false);
          }}
        />
      ) : null}
    </>
  );
}

const PAUSE_REASON_LABELS: Record<string, string> = {
  insufficient_destination_space: "Insufficient space at destination",
  insufficient_origin_stock: "Insufficient stock at origin",
  insufficient_trader_destination: "Insufficient traders at destination",
  insufficient_trader_origin: "Insufficient traders at origin",
};

function StatusBadge({
  pauseReason,
  status,
}: {
  readonly pauseReason?: string | null;
  readonly status: TradeRouteStatus;
}): JSX.Element {
  const styles: Record<TradeRouteStatus, string> = {
    active: "text-success-foreground",
    cancelled: "text-destructive",
    paused: "text-warning-foreground",
    proposed: "text-warning-foreground",
    replaced: "text-muted-foreground",
  };
  const labels: Record<TradeRouteStatus, string> = {
    active: "Active",
    cancelled: "Cancelled",
    paused: "Paused",
    proposed: "Proposed",
    replaced: "Replaced",
  };
  const title =
    status === "paused" && pauseReason !== null && pauseReason !== undefined
      ? (PAUSE_REASON_LABELS[pauseReason] ?? pauseReason)
      : undefined;
  return (
    <span className={`text-xs font-medium ${styles[status]}`} title={title}>
      {labels[status]}
    </span>
  );
}

function ApprovalBadge({
  label,
  status,
}: {
  readonly label: string;
  readonly status: TradeRouteApprovalStatus;
}): JSX.Element {
  const styles: Record<TradeRouteApprovalStatus, string> = {
    approved: "text-success-foreground",
    pending: "text-muted-foreground",
    rejected: "text-destructive",
  };
  const icons: Record<TradeRouteApprovalStatus, string> = {
    approved: "✓",
    pending: "…",
    rejected: "✗",
  };
  return (
    <span
      className={`text-xs font-medium ${styles[status]}`}
      title={`${label}: ${status}`}
    >
      {label}:{icons[status]}
    </span>
  );
}
