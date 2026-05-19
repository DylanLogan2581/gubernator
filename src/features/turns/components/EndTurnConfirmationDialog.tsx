import { StepForward, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SettlementReadinessSummary } from "@/features/settlements";

import { getReadinessSummaryDescription } from "../utils/endTurnDescriptions";

import { EndTurnMetric } from "./EndTurnMetric";

import type { JSX } from "react";

export function EndTurnConfirmationDialog({
  currentDateLabel,
  currentTurnNumber,
  isPending,
  nextDateLabel,
  nextTurnNumber,
  onCancel,
  onConfirm,
  readinessSummary,
}: {
  readonly currentDateLabel: string;
  readonly currentTurnNumber: number;
  readonly isPending: boolean;
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly readinessSummary: SettlementReadinessSummary;
}): JSX.Element {
  const hasNotReadySettlements = readinessSummary.notReadySettlementCount > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="end-turn-confirmation-title"
        aria-modal="true"
        className="grid w-full max-w-lg gap-5 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3
              id="end-turn-confirmation-title"
              className="text-lg font-semibold tracking-normal"
            >
              Confirm end turn
            </h3>
            <p className="text-sm text-muted-foreground">
              This transition advances world state and cannot be undone.
            </p>
          </div>
          <Button
            aria-label="Cancel end turn"
            disabled={isPending}
            onClick={onCancel}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <EndTurnMetric
            label="Current turn"
            value={currentTurnNumber.toString()}
          />
          <EndTurnMetric label="Next turn" value={nextTurnNumber.toString()} />
          <EndTurnMetric label="Current date" value={currentDateLabel} />
          <EndTurnMetric label="Next date" value={nextDateLabel} />
        </dl>

        <div className="rounded-md border border-border bg-background px-3 py-2">
          <p className="text-sm font-medium">Readiness summary</p>
          <p className="text-sm text-muted-foreground">
            {getReadinessSummaryDescription(readinessSummary)}
          </p>
        </div>

        {hasNotReadySettlements ? (
          <p
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Some settlements are not ready. You can still confirm and advance
            the turn.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={isPending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onConfirm} type="button">
            <StepForward aria-hidden="true" />
            {isPending ? "Ending turn..." : "Confirm end turn"}
          </Button>
        </div>
      </div>
    </div>
  );
}
