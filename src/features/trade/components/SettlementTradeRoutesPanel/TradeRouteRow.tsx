import { useState, type JSX } from "react";

import { IconChip } from "@/components/shared/IconChip";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { DOMAIN_ICON_CHIPS } from "@/lib/domainIconography";

import { ApprovalBadge } from "./ApprovalBadge";
import { ApproveConfirmDialog } from "./ApproveConfirmDialog";
import { CancelConfirmDialog } from "./CancelConfirmDialog";
import { LegsSummary } from "./LegsSummary";
import { RejectConfirmDialog } from "./RejectConfirmDialog";
import { ReplaceTradeRouteDialog } from "./ReplaceTradeRouteDialog";
import { StatusBadge } from "./StatusBadge";
import {
  CANCELLED_STATUSES,
  combinedApprovalStatus,
  formatCancelledDate,
} from "./TradeRouteHelpers";

import type { TradeRoute, TradeRouteStatus } from "../../types/tradeRouteTypes";
import type { QueryClient } from "@tanstack/react-query";

export function TradeRouteRow({
  activeCharacterId,
  canManageRoutes,
  isResumedThisTransition,
  isSelected,
  queryClient,
  route,
  settlementId,
  side,
  traderCount,
  worldId,
  onSelect,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly isResumedThisTransition: boolean;
  readonly isSelected: boolean;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly settlementId: string;
  readonly side: "destination" | "origin";
  readonly traderCount: number;
  readonly worldId: string;
  readonly onSelect: () => void;
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
        aria-selected={isSelected}
        className={`cursor-pointer ${isResumedThisTransition ? "animate-pulse bg-success [animation-iteration-count:4]" : ""}`}
        data-state={isSelected ? "selected" : undefined}
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <TableCell className="py-2 pr-4 font-medium">
          <span className="flex items-center gap-2">
            <IconChip
              icon={DOMAIN_ICON_CHIPS.trade.icon}
              tone={DOMAIN_ICON_CHIPS.trade.tone}
            />
            {counterpart}
          </span>
        </TableCell>
        <TableCell className="py-2 pr-4">
          <LegsSummary
            legs={route.legs}
            status={route.status}
            viewerSide={side}
          />
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
          <TableCell
            className="w-48 py-2 text-right"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
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
          worldId={worldId}
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
          worldId={worldId}
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
          worldId={worldId}
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
