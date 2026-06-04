import { StepForward, TriangleAlert } from "lucide-react";

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

import { EndTurnMetric } from "./EndTurnMetric";

import type { JSX } from "react";

const TRANSITION_PHASES = [
  "Jobs & resource production",
  "Deposit extraction",
  "Construction progress",
  "Building upkeep",
  "Trade routes",
  "Managed populations",
  "Citizen consumption",
  "Partnerships",
  "Homelessness",
] as const;

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
  const hasNotReadySettlements = readinessSummary.notReadySettlementCount > 0;

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

        <div className="rounded-md border border-border bg-background px-3 py-2">
          <p className="text-sm font-medium">The transition will run:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {TRANSITION_PHASES.map((phase) => (
              <li key={phase}>{phase}</li>
            ))}
          </ul>
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

        {errorMessage !== undefined ? (
          <p
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {errorMessage}
          </p>
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
