import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

import { getManualReadinessDescription } from "./SettlementReadinessDisplayText";

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
  const description = getManualReadinessDescription({
    isArchived,
    isAutoReady,
    isPending,
  });

  const control = (
    <Label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
      <Switch
        checked={state.isReadyForCurrentTurn}
        disabled={isDisabled}
        onCheckedChange={setReadiness}
      />
      <span className="min-w-[8rem] tabular-nums">Ready</span>
    </Label>
  );

  return (
    <>
      {description === "" ? (
        control
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{control}</TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      )}
      {population !== undefined && (
        <div className="text-sm text-muted-foreground">
          Population: {population.toLocaleString()}
        </div>
      )}
    </>
  );
}
