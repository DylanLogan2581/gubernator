import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type ManualReadinessControlProps = {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly population?: number;
  readonly setReadiness: (isReady: boolean) => void;
};

export function ManualReadinessControl({
  isArchived,
  isPending,
  item,
  population,
  setReadiness,
}: ManualReadinessControlProps): JSX.Element {
  const state = deriveSettlementReadinessState(item);
  const isAutoReady = state.kind === "auto-ready";
  const isDisabled = isArchived || isAutoReady || isPending;

  return (
    <>
      <Label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
        <Switch
          checked={state.isReadyForCurrentTurn}
          disabled={isDisabled}
          onCheckedChange={setReadiness}
        />
        <span className="min-w-[8rem] tabular-nums">Ready</span>
      </Label>
      {population !== undefined && (
        <div className="text-sm text-muted-foreground">
          Population: {population.toLocaleString()}
        </div>
      )}
    </>
  );
}
