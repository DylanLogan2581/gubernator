import { getReadinessStateLabel } from "./SettlementReadinessDisplayText";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

export function ReadinessStateBadge({
  item,
}: {
  readonly item: SettlementReadinessListItem;
}): JSX.Element {
  const label = getReadinessStateLabel(item);

  return (
    <span className="inline-flex w-fit rounded-sm border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

export function ReadOnlyReadinessIndicator({
  item,
}: {
  readonly item: SettlementReadinessListItem;
}): JSX.Element {
  const label = getReadinessStateLabel(item);

  return (
    <p className="text-sm text-muted-foreground" aria-label={label}>
      {label}
    </p>
  );
}
