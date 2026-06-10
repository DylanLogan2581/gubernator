import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
    <Label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
      <Switch
        checked={item.autoReadyEnabled}
        disabled={isDisabled}
        onCheckedChange={setAutoReady}
      />
      <span className="min-w-[8rem] tabular-nums">Auto-ready</span>
    </Label>
  );
}
