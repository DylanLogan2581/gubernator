import { StepForward, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  formatNationReadinessVoteProgress,
  type NationReadinessListItem,
} from "@/features/nations";
import type { SettlementReadinessSummary } from "@/features/settlements";

import { getReadinessSummaryDescription } from "../utils/endTurnDescriptions";

import { MetricTile } from "./EndTurnMetric";

import type { JSX } from "react";

export function EndTurnConfirmationDialog({
  blockingNations,
  currentDateLabel,
  currentTurnNumber,
  errorMessage,
  isNationOverrideAcknowledged,
  isPending,
  nextDateLabel,
  nextTurnNumber,
  onClose,
  onConfirm,
  onNationOverrideAcknowledgedChange,
  readinessSummary,
  requiresNationOverrideConfirmation,
}: {
  readonly blockingNations: readonly NationReadinessListItem[];
  readonly currentDateLabel: string;
  readonly currentTurnNumber: number;
  readonly errorMessage?: string;
  readonly isNationOverrideAcknowledged: boolean;
  readonly isPending: boolean;
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly onNationOverrideAcknowledgedChange: (acknowledged: boolean) => void;
  readonly readinessSummary: SettlementReadinessSummary;
  readonly requiresNationOverrideConfirmation: boolean;
}): JSX.Element {
  const isConfirmDisabled =
    isPending ||
    (requiresNationOverrideConfirmation && !isNationOverrideAcknowledged);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm turn transition</DialogTitle>
          <DialogDescription>
            This runs the full simulation and advances world state. It cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 sm:grid-cols-2">
          <MetricTile
            label="Current turn"
            value={currentTurnNumber.toString()}
          />
          <MetricTile label="Next turn" value={nextTurnNumber.toString()} />
          <MetricTile label="Current date" value={currentDateLabel} />
          <MetricTile label="Next date" value={nextDateLabel} />
        </dl>

        <div className="rounded-md border border-border bg-background px-3 py-2">
          <p className="text-sm font-medium">Readiness summary</p>
          <p className="text-sm text-muted-foreground">
            {getReadinessSummaryDescription(readinessSummary)}
          </p>
        </div>

        {requiresNationOverrideConfirmation ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            <AlertDescription className="space-y-2">
              <p className="font-medium text-foreground">
                {blockingNations.length.toString()} nation
                {blockingNations.length === 1 ? "" : "s"} not ready:
              </p>
              <ul className="list-inside list-disc space-y-1">
                {blockingNations.map((nation) => (
                  <li key={nation.nationId}>
                    {nation.nationName} —{" "}
                    {formatNationReadinessVoteProgress(nation)}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="nation-override-acknowledged"
                  checked={isNationOverrideAcknowledged}
                  onCheckedChange={(checked) => {
                    onNationOverrideAcknowledgedChange(checked === true);
                  }}
                />
                <Label
                  htmlFor="nation-override-acknowledged"
                  className="font-normal"
                >
                  Advance anyway
                </Label>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage !== undefined ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isConfirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            <StepForward aria-hidden="true" />
            {isPending ? "Running..." : "Confirm turn transition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
