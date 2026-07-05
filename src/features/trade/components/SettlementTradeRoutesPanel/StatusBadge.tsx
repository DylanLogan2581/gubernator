import { Badge } from "@/components/ui/badge";

import { PAUSE_REASON_LABELS } from "./TradeRouteHelpers";

import type { TradeRouteStatus } from "../../types/tradeRouteTypes";
import type { JSX } from "react";

export function StatusBadge({
  pauseReason,
  status,
}: {
  readonly pauseReason?: string | null;
  readonly status: TradeRouteStatus;
}): JSX.Element {
  const variantMap: Record<
    TradeRouteStatus,
    "success" | "destructive" | "warning" | "outline"
  > = {
    active: "success",
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

  return (
    <Badge title={title} variant={variantMap[status]}>
      {labels[status]}
    </Badge>
  );
}
