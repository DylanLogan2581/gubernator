import type { Nation, NationRelationshipStance } from "@/features/nations";

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
  nations_at_war: "Nations at war",
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

// Trade policy (#1087): a client-side preview of the propose_trade_route
// gate in 20260912000000_add_nation_trade_policy, so the propose dialog can
// disable submission and explain why *before* round-tripping to the RPC.
// Internal (same-nation) routes are never blocked, regardless of policy —
// callers should only invoke this once origin/destination nations differ.
// Returns null when the route would be allowed.
export function describeForeignTradeBlock({
  canManageOriginNation,
  destinationNation,
  originNation,
}: {
  readonly canManageOriginNation: boolean;
  readonly destinationNation: Nation;
  readonly originNation: Nation;
}): string | null {
  if (originNation.tradePolicy === "closed") {
    return `${originNation.name} has closed its borders to trade.`;
  }
  if (destinationNation.tradePolicy === "closed") {
    return `${destinationNation.name} has closed its borders to trade.`;
  }
  if (
    originNation.tradePolicy === "state_controlled" &&
    !canManageOriginNation
  ) {
    return `${originNation.name}'s trade is state-controlled — only a nation manager can propose external trade routes.`;
  }
  return null;
}

// Diplomacy consequences (#1088): a client-side preview of the
// propose_trade_route stance gate, so the propose dialog can disable
// submission and explain why before round-tripping to the RPC. Only used
// for international pairs — callers should not invoke this for same-nation
// routes.
export function describeStanceTradeBlock({
  destinationNation,
  originNation,
  stance,
}: {
  readonly destinationNation: Nation;
  readonly originNation: Nation;
  readonly stance: NationRelationshipStance | null;
}): string | null {
  if (stance === "at_war") {
    return `${originNation.name} and ${destinationNation.name} are at war — trade routes cannot be proposed.`;
  }
  if (stance === "hostile") {
    return `${originNation.name} and ${destinationNation.name} are hostile toward each other — trade routes cannot be proposed.`;
  }
  return null;
}
