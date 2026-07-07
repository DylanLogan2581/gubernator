import { ApprovalBadge } from "./ApprovalBadge";
import { LegsSummary } from "./LegsSummary";
import { StatusBadge } from "./StatusBadge";
import { combinedApprovalStatus } from "./TradeRouteHelpers";

import type { TradeRoute } from "../../types/tradeRouteTypes";
import type { JSX } from "react";

export function TradeRouteDetailPanel({
  route,
  side,
  traderCount,
}: {
  readonly route: TradeRoute;
  readonly side: "destination" | "origin";
  readonly traderCount: number;
}): JSX.Element {
  return (
    <div className="grid gap-3 text-sm">
      <div className="grid grid-cols-2 gap-y-2">
        <span className="text-muted-foreground">Status</span>
        <span>
          <StatusBadge
            pauseReason={route.pauseReasonLastTransition}
            status={route.status}
          />
        </span>
        <span className="text-muted-foreground">Approval</span>
        <span>
          <ApprovalBadge status={combinedApprovalStatus(route)} />
        </span>
        <span className="text-muted-foreground">Traders assigned</span>
        <span className="tabular-nums">{traderCount}</span>
      </div>
      <div className="grid gap-1">
        <span className="text-muted-foreground">Legs</span>
        <LegsSummary
          legs={route.legs}
          status={route.status}
          viewerSide={side}
        />
      </div>
      <div className="grid gap-1">
        <span className="text-muted-foreground">Shipments</span>
        <span className="text-muted-foreground">Not tracked yet</span>
      </div>
    </div>
  );
}
