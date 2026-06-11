import { StepForward, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SettlementReadinessSummary } from "@/features/settlements";

import { getReadinessSummaryDescription } from "../utils/endTurnDescriptions";

import { MetricTile } from "./EndTurnMetric";

import type { JSX } from "react";

export function EndTurnConfirmationDialog({
  currentDateLabel,
  currentTurnNumber,
  errorMessage,
  isPending,
  nextDateLabel,
  nextTurnNumber,
  onClose,
  onConfirm,
  readinessSummary,
}: {
  readonly currentDateLabel: string;
  readonly currentTurnNumber: number;
  readonly errorMessage?: string;
  readonly isPending: boolean;
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly readinessSummary: SettlementReadinessSummary;
}): JSX.Element {
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
          <Button disabled={isPending} onClick={onConfirm} type="button">
            <StepForward aria-hidden="true" />
            {isPending ? "Running..." : "Confirm turn transition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
