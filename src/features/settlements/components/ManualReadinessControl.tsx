import { cn } from "@/lib/utils";

import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type ManualReadinessControlProps = {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly setReadiness: (isReady: boolean) => void;
};

export function ManualReadinessControl({
  isArchived,
  isPending,
  item,
  setReadiness,
}: ManualReadinessControlProps): JSX.Element {
  const state = deriveSettlementReadinessState(item);
  const isAutoReady = state.kind === "auto-ready";
  const isDisabled = isArchived || isAutoReady || isPending;

  return (
    <label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
      <input
        checked={state.isReadyForCurrentTurn}
        className="peer sr-only"
        disabled={isDisabled}
        onChange={(event) => {
          setReadiness(event.currentTarget.checked);
        }}
        role="switch"
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 rounded-full border border-border bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:opacity-50",
          "after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:after:translate-x-4",
        )}
      />
      <span className="min-w-[8rem] tabular-nums">Ready</span>
    </label>
  );
}
