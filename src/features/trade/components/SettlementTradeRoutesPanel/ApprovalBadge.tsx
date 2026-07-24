import { Check, Clock, X } from "lucide-react";

import {
  StatusBadge as SharedStatusBadge,
  type StatusBadgeConfigEntry,
} from "@/components/shared/StatusBadge";

import type { TradeRouteApprovalStatus } from "../../types/tradeRouteTypes";
import type { JSX } from "react";

const APPROVAL_CONFIG: Record<
  TradeRouteApprovalStatus,
  StatusBadgeConfigEntry
> = {
  approved: {
    label: "Approved",
    variant: "success",
    icon: <Check className="size-3" />,
  },
  pending: {
    label: "Pending",
    variant: "outline",
    icon: <Clock className="size-3" />,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: <X className="size-3" />,
  },
};

export function ApprovalBadge({
  label,
  status,
}: {
  readonly label?: string;
  readonly status: TradeRouteApprovalStatus;
}): JSX.Element {
  return (
    <SharedStatusBadge
      config={APPROVAL_CONFIG}
      labelPrefix={label}
      status={status}
    />
  );
}
