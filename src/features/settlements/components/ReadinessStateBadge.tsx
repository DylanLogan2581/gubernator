import { Badge } from "@/components/ui/badge";

import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

import { getReadinessStateLabel } from "./SettlementReadinessDisplayText";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

export function ReadinessStateBadge({
  item,
}: {
  readonly item: SettlementReadinessListItem;
}): JSX.Element {
  const state = deriveSettlementReadinessState(item);
  const label = getReadinessStateLabel(state);

  return <Badge variant="outline">{label}</Badge>;
}

export function ReadOnlyReadinessIndicator({
  item,
}: {
  readonly item: SettlementReadinessListItem;
}): JSX.Element {
  const state = deriveSettlementReadinessState(item);
  const label = getReadinessStateLabel(state);

  return (
    <p className="text-sm text-muted-foreground" aria-label={label}>
      {label}
    </p>
  );
}
