import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import {
  getManualReadinessDescription,
  getManualReadinessLabel,
} from "./SettlementReadinessDisplayText";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type ManualReadinessControlProps = {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly mutationError: Error | null;
  readonly setReadiness: (isReady: boolean) => void;
};

export function ManualReadinessControl({
  isArchived,
  isPending,
  item,
  mutationError,
  setReadiness,
}: ManualReadinessControlProps): JSX.Element {
  const descriptionId = `settlement-readiness-${item.id}-description`;
  const errorId = `settlement-readiness-${item.id}-error`;
  const isAutoReady = item.autoReadyEnabled;
  const isDisabled = isArchived || isAutoReady || isPending;
  const description = getManualReadinessDescription({
    isArchived,
    isAutoReady,
    isPending,
  });
  const label = getManualReadinessLabel(item);

  return (
    <div className="grid gap-2">
      <label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
        <input
          aria-describedby={
            mutationError === null
              ? descriptionId
              : `${descriptionId} ${errorId}`
          }
          aria-invalid={mutationError === null ? undefined : true}
          checked={item.isReadyForCurrentTurn}
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
        <span>{label}</span>
      </label>
      <p id={descriptionId} className="max-w-64 text-xs text-muted-foreground">
        {description}
      </p>
      {mutationError === null ? null : (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {getErrorDescription(mutationError)}
        </p>
      )}
    </div>
  );
}
