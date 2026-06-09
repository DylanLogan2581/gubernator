import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type AutoReadyControlProps = {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
};

export function AutoReadyControl({
  isArchived,
  isPending,
  item,
  setAutoReady,
}: AutoReadyControlProps): JSX.Element {
  const isDisabled = isArchived || isPending;

  return (
    <Label
      className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground"
      htmlFor="auto-ready-switch"
    >
      <input
        checked={item.autoReadyEnabled}
        className="peer sr-only"
        disabled={isDisabled}
        id="auto-ready-switch"
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
      <span className="min-w-[8rem] tabular-nums">Auto-ready</span>
    </Label>
  );
}
