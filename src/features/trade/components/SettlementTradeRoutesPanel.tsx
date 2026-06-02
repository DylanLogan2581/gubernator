import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { settlementTargetAssignmentsQueryOptions } from "@/features/citizens";
import { useActivePlayerCharacter } from "@/features/permissions";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";

import { approveTradeRouteSideMutationOptions } from "../mutations/approveTradeRouteSideMutations";
import { cancelTradeRouteMutationOptions } from "../mutations/cancelTradeRouteMutations";
import { proposeTradeRouteMutationOptions } from "../mutations/proposeTradeRouteMutations";
import { rejectTradeRouteSideMutationOptions } from "../mutations/rejectTradeRouteSideMutations";
import { replaceTradeRouteMutationOptions } from "../mutations/replaceTradeRouteMutations";
import { tradeRoutesForSettlementQueryOptions } from "../queries/tradeRoutesQueries";

import type {
  TradeRoute,
  TradeRouteApprovalStatus,
  TradeRouteStatus,
} from "../types/tradeRouteTypes";

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

  const routesQuery = useQuery(
    tradeRoutesForSettlementQueryOptions(settlementId),
  );
  const assignmentsQuery = useQuery(
    settlementTargetAssignmentsQueryOptions(settlementId),
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

  const traderCountByRoute = new Map<string, number>();
  if (assignmentsQuery.data !== undefined) {
    for (const a of assignmentsQuery.data) {
      if (a.assignmentType === "trade_route" && a.tradeRouteId !== null) {
        traderCountByRoute.set(
          a.tradeRouteId,
          (traderCountByRoute.get(a.tradeRouteId) ?? 0) + 1,
        );
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
      <TradeRoutesPanelHeader
        canManageRoutes={canManageRoutes && !routesQuery.isPending}
        activeCharacterId={activeCharacter?.id ?? null}
        queryClient={queryClient}
        settlementId={settlementId}
        worldId={worldId}
      />

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

function TradeRoutesPanelHeader({
  activeCharacterId,
  canManageRoutes,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const [showProposeDialog, setShowProposeDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2
          id="settlement-trade-routes-heading"
          className="text-base font-medium"
        >
          Trade Routes
        </h2>
        {canManageRoutes && activeCharacterId !== null ? (
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
      {showProposeDialog && activeCharacterId !== null ? (
        <ProposeTradeRouteDialog
          activeCharacterId={activeCharacterId}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setShowProposeDialog(false);
          }}
        />
      ) : null}
    </>
  );
}

function TradeRoutesDirection({
  activeCharacterId,
  canManageRoutes,
  label,
  queryClient,
  routes,
  settlementId,
  side,
  traderCountByRoute,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly label: string;
  readonly queryClient: QueryClient;
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
  queryClient,
  route,
  settlementId,
  side,
  traderCount,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
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
        className="border-b border-border last:border-0"
      >
        <td className="py-2 pr-4 font-medium">{counterpart}</td>
        <td className="py-2 pr-4 text-muted-foreground">
          {route.resourceName}
        </td>
        <td className="py-2 pr-4 tabular-nums">
          {route.quantityPerTransition.toLocaleString()}
        </td>
        <td className="py-2 pr-4">
          <StatusBadge status={route.status} />
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

function StatusBadge({
  status,
}: {
  readonly status: TradeRouteStatus;
}): JSX.Element {
  const styles: Record<TradeRouteStatus, string> = {
    active: "text-green-700",
    cancelled: "text-destructive",
    paused: "text-amber-600",
    proposed: "text-amber-600",
    replaced: "text-muted-foreground",
  };
  const labels: Record<TradeRouteStatus, string> = {
    active: "Active",
    cancelled: "Cancelled",
    paused: "Paused",
    proposed: "Proposed",
    replaced: "Replaced",
  };
  return (
    <span className={`text-xs font-medium ${styles[status]}`}>
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
    approved: "text-green-700",
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

function ApproveConfirmDialog({
  approverCitizenId,
  counterpart,
  onClose,
  queryClient,
  route,
  settlementId,
  side,
}: {
  readonly approverCitizenId: string;
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly settlementId: string;
  readonly side: "destination" | "origin";
}): JSX.Element {
  const mutation = useMutation(
    approveTradeRouteSideMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      const result = await mutation.mutateAsync({
        approverCitizenId,
        side,
        tradeRouteId: route.id,
      });
      const label =
        result.status === "active"
          ? "Trade route approved and now active."
          : "Trade route side approved.";
      notifyMutationSuccess(label);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to approve trade route.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve trade route?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Approve the{" "}
          <span className="font-medium text-foreground">
            {side === "origin" ? "origin" : "destination"}
          </span>{" "}
          side of the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?{" "}
          {route.originSettlementId === settlementId
            ? "The route becomes active once both sides have approved."
            : ""}
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectConfirmDialog({
  counterpart,
  onClose,
  queryClient,
  rejectorCitizenId,
  route,
  side,
}: {
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly rejectorCitizenId: string;
  readonly route: TradeRoute;
  readonly side: "destination" | "origin";
}): JSX.Element {
  const mutation = useMutation(
    rejectTradeRouteSideMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({
        rejectorCitizenId,
        side,
        tradeRouteId: route.id,
      });
      notifyMutationSuccess("Trade route rejected.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to reject trade route.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject trade route?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Reject the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?
          This cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelConfirmDialog({
  counterpart,
  onClose,
  queryClient,
  route,
  traderCount,
}: {
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly traderCount: number;
}): JSX.Element {
  const mutation = useMutation(
    cancelTradeRouteMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    const countBefore = traderCount;
    try {
      await mutation.mutateAsync({ tradeRouteId: route.id });
      if (countBefore > 0) {
        notifyMutationSuccess(
          `Trade route cancelled. ${countBefore.toString()} ${countBefore === 1 ? "trader was" : "traders were"} unassigned.`,
        );
      } else {
        notifyMutationSuccess("Trade route cancelled.");
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to cancel trade route.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel trade route?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Cancel the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?
          {traderCount > 0 ? (
            <>
              {" "}
              <span className="font-medium text-foreground">
                {traderCount.toString()}{" "}
                {traderCount === 1 ? "trader" : "traders"}
              </span>{" "}
              will be unassigned.
            </>
          ) : null}
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Keep
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Cancel route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RouteFormValues = {
  destinationSettlementId: string;
  originSettlementId: string;
  quantityPerTransition: string;
  resourceId: string;
};

function ProposeTradeRouteDialog({
  activeCharacterId,
  onClose,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly activeCharacterId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const mutation = useMutation(
    proposeTradeRouteMutationOptions({ queryClient }),
  );

  const [form, setForm] = useState<RouteFormValues>({
    destinationSettlementId: "",
    originSettlementId: settlementId,
    quantityPerTransition: "",
    resourceId: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof RouteFormValues, string>>
  >({});

  const settlements = (settlementsQuery.data ?? []).filter(
    (s) => s.id !== settlementId,
  );
  const resources = resourcesQuery.data ?? [];

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const newErrors: Partial<Record<keyof RouteFormValues, string>> = {};

    if (form.destinationSettlementId === "") {
      newErrors.destinationSettlementId = "Select a destination settlement.";
    }
    if (form.resourceId === "") {
      newErrors.resourceId = "Select a resource.";
    }
    const qty = parseFloat(form.quantityPerTransition);
    if (form.quantityPerTransition === "" || Number.isNaN(qty) || qty <= 0) {
      newErrors.quantityPerTransition = "Quantity must be greater than zero.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    mutation.mutate(
      {
        destinationSettlementId: form.destinationSettlementId,
        originSettlementId: form.originSettlementId,
        proposingCitizenId: activeCharacterId,
        quantityPerTransition: qty,
        resourceId: form.resourceId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to propose trade route.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Trade route proposed.");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Propose trade route</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Destination settlement
              </span>
              {settlementsQuery.isPending ? (
                <span className="text-xs text-muted-foreground">
                  Loading settlements…
                </span>
              ) : settlements.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No other settlements available.
                </span>
              ) : (
                <NativeSelect
                  aria-invalid={errors.destinationSettlementId !== undefined}
                  aria-label="Destination settlement"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={form.destinationSettlementId}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    setForm((prev) => ({
                      ...prev,
                      destinationSettlementId: val,
                    }));
                  }}
                >
                  <option value="">Select a settlement…</option>
                  {sortByName(settlements).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.nationName})
                    </option>
                  ))}
                </NativeSelect>
              )}
              {errors.destinationSettlementId !== undefined ? (
                <p className="text-xs text-destructive">
                  {errors.destinationSettlementId}
                </p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Resource</span>
              {resources.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No active resources available.
                </span>
              ) : (
                <NativeSelect
                  aria-invalid={errors.resourceId !== undefined}
                  aria-label="Resource"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={form.resourceId}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    setForm((prev) => ({
                      ...prev,
                      resourceId: val,
                    }));
                  }}
                >
                  <option value="">Select a resource…</option>
                  {sortByName(resources).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {errors.resourceId !== undefined ? (
                <p className="text-xs text-destructive">{errors.resourceId}</p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Quantity per turn</span>
              <Input
                aria-invalid={errors.quantityPerTransition !== undefined}
                aria-label="Quantity per turn"
                disabled={mutation.isPending}
                inputMode="numeric"
                placeholder="e.g. 10"
                value={form.quantityPerTransition}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setForm((prev) => ({
                    ...prev,
                    quantityPerTransition: val,
                  }));
                }}
              />
              {errors.quantityPerTransition !== undefined ? (
                <p className="text-xs text-destructive">
                  {errors.quantityPerTransition}
                </p>
              ) : null}
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Propose
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceTradeRouteDialog({
  activeCharacterId,
  counterpart,
  onClose,
  queryClient,
  route,
}: {
  readonly activeCharacterId: string;
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
}): JSX.Element {
  const mutation = useMutation(
    replaceTradeRouteMutationOptions({ queryClient }),
  );

  const [quantityPerTransition, setQuantityPerTransition] = useState(
    String(route.quantityPerTransition),
  );
  const [qtyError, setQtyError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setQtyError(undefined);

    const qty = parseFloat(quantityPerTransition);
    if (quantityPerTransition === "" || Number.isNaN(qty) || qty <= 0) {
      setQtyError("Quantity must be greater than zero.");
      return;
    }

    mutation.mutate(
      {
        newRoutePayload: {
          destinationSettlementId: route.destinationSettlementId,
          originSettlementId: route.originSettlementId,
          quantityPerTransition: qty,
          resourceId: route.resourceId,
        },
        oldRouteId: route.id,
        proposingCitizenId: activeCharacterId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to replace trade route.");
        },
        onSuccess: () => {
          notifyMutationSuccess(
            "Trade route replaced. New proposal pending approval.",
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Replace trade route</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Replace the route with{" "}
            <span className="font-medium text-foreground">{counterpart}</span>.
            A new proposal will be created pending approval.
          </DialogDescription>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Resource</span>
              <p className="text-sm">{route.resourceName}</p>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                New quantity per turn
              </span>
              <Input
                aria-invalid={qtyError !== undefined}
                aria-label="New quantity per turn"
                disabled={mutation.isPending}
                inputMode="numeric"
                value={quantityPerTransition}
                onChange={(e) => {
                  setQuantityPerTransition(e.currentTarget.value);
                }}
              />
              {qtyError !== undefined ? (
                <p className="text-xs text-destructive">{qtyError}</p>
              ) : null}
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Replace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
