import {
  StatusBadge as SharedStatusBadge,
  type StatusBadgeConfigEntry,
} from "@/components/shared/StatusBadge";

import { PAUSE_REASON_LABELS } from "./TradeRouteHelpers";

import type { TradeRouteStatus } from "../../types/tradeRouteTypes";
import type { JSX } from "react";

const STATUS_CONFIG: Record<TradeRouteStatus, StatusBadgeConfigEntry> = {
  active: { label: "Active", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  paused: { label: "Paused", variant: "warning" },
  proposed: { label: "Proposed", variant: "warning" },
  replaced: { label: "Replaced", variant: "outline" },
};

export function StatusBadge({
  pauseReason,
  status,
}: {
  readonly pauseReason?: string | null;
  readonly status: TradeRouteStatus;
}): JSX.Element {
  const title =
    status === "paused" && pauseReason !== null && pauseReason !== undefined
      ? (PAUSE_REASON_LABELS[pauseReason] ?? pauseReason)
      : undefined;

  return (
    <SharedStatusBadge config={STATUS_CONFIG} status={status} title={title} />
  );
}
