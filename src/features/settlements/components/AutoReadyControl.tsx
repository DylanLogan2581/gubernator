import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import { getAutoReadyDescription } from "./SettlementReadinessDisplayText";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type AutoReadyControlProps = {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly mutationError: Error | null;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
};

export function AutoReadyControl({
  isArchived,
  isPending,
  item,
  mutationError,
  setAutoReady,
}: AutoReadyControlProps): JSX.Element {
  const descriptionId = `settlement-auto-ready-${item.id}-description`;
  const errorId = `settlement-auto-ready-${item.id}-error`;
  const isDisabled = isArchived || isPending;
  const description = getAutoReadyDescription({ isArchived, isPending });

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
          checked={item.autoReadyEnabled}
          className="peer sr-only"
          disabled={isDisabled}
          onChange={(event) => {
            setAutoReady(event.currentTarget.checked);
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
        <span>Auto-ready</span>
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
