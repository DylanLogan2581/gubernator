import { Check, Clock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { TradeRouteApprovalStatus } from "../../types/tradeRouteTypes";
import type { JSX } from "react";

export function ApprovalBadge({
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
    "success" | "outline" | "destructive"
  > = {
    approved: "success",
    pending: "outline",
    rejected: "destructive",
  };

  return (
    <Badge variant={variantMap[status]}>
      <span>
        {label === undefined
          ? statusLabels[status]
          : `${label} ${statusLabels[status]}`}
      </span>
      {iconMap[status]}
    </Badge>
  );
}
