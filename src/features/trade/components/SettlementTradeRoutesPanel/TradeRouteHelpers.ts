import type {
  TradeRoute,
  TradeRouteApprovalStatus,
} from "../../types/tradeRouteTypes";

export const ACTIVE_STATUSES = new Set(["proposed", "active", "paused"]);
export const CANCELLED_STATUSES = new Set(["cancelled", "replaced"]);

export const CANCELLED_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "2-digit",
});

export function formatCancelledDate(timestamp: string): string {
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? timestamp : CANCELLED_DATE_FORMATTER.format(ms);
}

export const PAUSE_REASON_LABELS: Record<string, string> = {
  insufficient_destination_space: "Insufficient space at destination",
  insufficient_destination_stock: "Insufficient stock at destination",
  insufficient_origin_space: "Insufficient space at origin",
  insufficient_origin_stock: "Insufficient stock at origin",
  insufficient_trader_destination: "Insufficient traders at destination",
  insufficient_trader_origin: "Insufficient traders at origin",
};

// Only the recipient side requires approval (the proposer's side is auto-approved
// at propose time), so the two per-side statuses collapse to one route-level
// status: rejected wins, then any still-pending side, otherwise approved.
export function combinedApprovalStatus(
  route: TradeRoute,
): TradeRouteApprovalStatus {
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
