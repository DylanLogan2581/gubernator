import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { useWorldTransitionOutcome } from "@/features/turns";
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
  TradeRouteLeg,
  TradeRouteStatus,
} from "../../types/tradeRouteTypes";

const ACTIVE_STATUSES = new Set(["proposed", "active", "paused"]);
const CANCELLED_STATUSES = new Set(["cancelled", "replaced"]);

const CANCELLED_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "2-digit",
});

function formatCancelledDate(timestamp: string): string {
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? timestamp : CANCELLED_DATE_FORMATTER.format(ms);
}

type SettlementTradeRoutesPanelProps = {
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementTradeRoutesPanel({
  canManage,
  isArchived,
  settlementId,
  worldId,
}: SettlementTradeRoutesPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();
  const [showProposeDialog, setShowProposeDialog] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

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

  return (
    <Card
      aria-labelledby="settlement-trade-routes-heading"
      className="grid gap-3"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
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
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {showProposeDialog ? (
        <div className="px-4">
          <ProposeTradeRouteDialog
            activeCharacterId={activeCharacter?.id ?? ""}
            queryClient={queryClient}
            settlementId={settlementId}
            worldId={worldId}
            onClose={() => {
              setShowProposeDialog(false);
            }}
          />
        </div>
      ) : null}

      <CardContent>
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
          <div className="grid gap-4">
            <TradeRoutesDirection
              activeCharacterId={activeCharacter?.id ?? null}
              canManageRoutes={showCancelled ? false : canManageRoutes}
              label="Outgoing"
              queryClient={queryClient}
              resumedRouteIds={resumedRouteIds}
              routes={outgoing}
              settlementId={settlementId}
              side="origin"
              traderCountByRoute={traderCountByRoute}
              worldId={worldId}
            />
            <TradeRoutesDirection
              activeCharacterId={activeCharacter?.id ?? null}
              canManageRoutes={showCancelled ? false : canManageRoutes}
              label="Incoming"
              queryClient={queryClient}
              resumedRouteIds={resumedRouteIds}
              routes={incoming}
              settlementId={settlementId}
              side="destination"
              traderCountByRoute={traderCountByRoute}
              worldId={worldId}
            />
          </div>
        )}
      </CardContent>
    </Card>
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
  worldId,
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
  readonly worldId: string;
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
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="text-muted-foreground">
                <TableHead scope="col">
                  {side === "origin" ? "Destination" : "Origin"}
                </TableHead>
                <TableHead scope="col">Resources</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Approval</TableHead>
                {canManageRoutes ? (
                  <TableHead
                    scope="col"
                    className="w-48"
                    aria-label="Actions"
                  />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
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
                  worldId={worldId}
                />
              ))}
            </TableBody>
          </Table>
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
  worldId,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly isResumedThisTransition: boolean;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly settlementId: string;
  readonly side: "destination" | "origin";
  readonly traderCount: number;
  readonly worldId: string;
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
      <TableRow
        id={`trade-route-${route.id}`}
        aria-live={isResumedThisTransition ? "polite" : undefined}
        className={`${isResumedThisTransition ? "animate-pulse bg-success [animation-iteration-count:4]" : ""}`}
      >
        <TableCell className="py-2 pr-4 font-medium">{counterpart}</TableCell>
        <TableCell className="py-2 pr-4">
          <LegsSummary legs={route.legs} viewerSide={side} />
        </TableCell>
        <TableCell className="py-2 pr-4">
          <StatusBadge
            pauseReason={route.pauseReasonLastTransition}
            status={route.status}
          />
          {CANCELLED_STATUSES.has(route.status) ? (
            <span className="block text-xs text-muted-foreground">
              {formatCancelledDate(route.updatedAt)}
            </span>
          ) : null}
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
        </TableCell>
        <TableCell className="py-2 pr-4">
          <ApprovalBadge status={combinedApprovalStatus(route)} />
        </TableCell>
        {canManageRoutes ? (
          <TableCell className="w-48 py-2 text-right">
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
          </TableCell>
        ) : null}
      </TableRow>
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
          worldId={worldId}
          onClose={() => {
            setShowReplaceDialog(false);
          }}
        />
      ) : null}
    </>
  );
}

function LegsSummary({
  legs,
  viewerSide,
}: {
  readonly legs: readonly TradeRouteLeg[];
  readonly viewerSide: "destination" | "origin";
}): JSX.Element {
  if (legs.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const items = legs.map((leg) => {
    // From the viewer's perspective:
    // - origin viewer: "send" legs are negative (outgoing), "receive" legs are positive (incoming)
    // - destination viewer: "send" legs are positive (incoming), "receive" legs are negative (outgoing)
    const isNegative =
      (viewerSide === "origin" && leg.direction === "send") ||
      (viewerSide === "destination" && leg.direction === "receive");
    const sign = isNegative ? "−" : "+";
    const colorClass = isNegative
      ? "text-destructive"
      : "text-success-foreground";
    return { colorClass, leg, sign };
  });

  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs tabular-nums">
      {items.map(({ colorClass, leg, sign }) => (
        <span key={leg.id} className={`font-medium ${colorClass}`}>
          {sign}
          {leg.quantityPerTransition.toLocaleString()} {leg.resourceName}
        </span>
      ))}
    </span>
  );
}

const PAUSE_REASON_LABELS: Record<string, string> = {
  insufficient_destination_space: "Insufficient space at destination",
  insufficient_destination_stock: "Insufficient stock at destination",
  insufficient_origin_space: "Insufficient space at origin",
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
  const variantMap: Record<
    TradeRouteStatus,
    "default" | "destructive" | "warning" | "outline"
  > = {
    active: "default",
    cancelled: "destructive",
    paused: "warning",
    proposed: "warning",
    replaced: "outline",
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

  const variant = variantMap[status];
  const className =
    status === "active" ? "bg-success text-success-foreground" : undefined;

  return (
    <Badge className={className} title={title} variant={variant}>
      {labels[status]}
    </Badge>
  );
}

// Only the recipient side requires approval (the proposer's side is auto-approved
// at propose time), so the two per-side statuses collapse to one route-level
// status: rejected wins, then any still-pending side, otherwise approved.
function combinedApprovalStatus(route: TradeRoute): TradeRouteApprovalStatus {
  if (
    route.originApprovalStatus === "rejected" ||
    route.destinationApprovalStatus === "rejected"
  ) {
    return "rejected";
  }
  if (
    route.originApprovalStatus === "pending" ||
    route.destinationApprovalStatus === "pending"
  ) {
    return "pending";
  }
  return "approved";
}

function ApprovalBadge({
  label,
  status,
}: {
  readonly label?: string;
  readonly status: TradeRouteApprovalStatus;
}): JSX.Element {
  const statusLabels: Record<TradeRouteApprovalStatus, string> = {
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
  };
  const iconMap: Record<TradeRouteApprovalStatus, React.ReactNode> = {
    approved: <Check className="size-3" />,
    pending: <Clock className="size-3" />,
    rejected: <X className="size-3" />,
  };
  const variantMap: Record<
    TradeRouteApprovalStatus,
    "default" | "outline" | "destructive"
  > = {
    approved: "default",
    pending: "outline",
    rejected: "destructive",
  };
  const className =
    status === "approved" ? "bg-success text-success-foreground" : undefined;

  return (
    <Badge className={className} variant={variantMap[status]}>
      <span>
        {label === undefined
          ? statusLabels[status]
          : `${label} ${statusLabels[status]}`}
      </span>
      {iconMap[status]}
    </Badge>
  );
}
