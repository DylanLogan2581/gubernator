import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import type {
  TradeRouteLeg,
  TradeRouteStatus,
} from "../../types/tradeRouteTypes";
import type { JSX } from "react";

const PROBLEM_STATUSES = new Set<TradeRouteStatus>(["paused"]);

export function LegsSummary({
  legs,
  status,
  viewerSide,
}: {
  readonly legs: readonly TradeRouteLeg[];
  readonly status: TradeRouteStatus;
  readonly viewerSide: "destination" | "origin";
}): JSX.Element {
  if (legs.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const isProblem = PROBLEM_STATUSES.has(status);
  const colorClass = isProblem ? "text-destructive" : "text-foreground";

  const items = legs.map((leg) => {
    // From the viewer's perspective:
    // - origin viewer: "send" legs are outbound, "receive" legs are inbound
    // - destination viewer: "send" legs are inbound, "receive" legs are outbound
    const isOutbound =
      (viewerSide === "origin" && leg.direction === "send") ||
      (viewerSide === "destination" && leg.direction === "receive");
    return { isOutbound, leg };
  });

  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs tabular-nums">
      {items.map(({ isOutbound, leg }) => (
        <span
          key={leg.id}
          className={`flex items-center gap-0.5 font-medium ${colorClass}`}
        >
          {isOutbound ? (
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
          ) : (
            <ArrowDownLeft aria-hidden="true" className="h-3 w-3" />
          )}
          <span className="sr-only">{isOutbound ? "Outbound" : "Inbound"}</span>
          {leg.quantityPerTransition.toLocaleString()} {leg.resourceName}
        </span>
      ))}
    </span>
  );
}
