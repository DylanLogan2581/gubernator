import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, StepForward, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  settlementReadinessSummaryQueryOptions,
  type SettlementReadinessSummary,
} from "@/features/settlements";

import {
  endTurnBasicMutationOptions,
  isEndTurnBasicError,
} from "../mutations/endTurnBasicMutations";

import type { JSX } from "react";

type EndTurnControlProps = {
  readonly canAdmin: boolean;
  readonly currentDateLabel: string;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly worldId: string;
};
type SuccessfulEndTurnTransition = {
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly previousDateLabel: string;
  readonly previousTurnNumber: number;
};

export function EndTurnControl({
  canAdmin,
  currentDateLabel,
  currentTurnNumber,
  isArchived,
  nextDateLabel,
  nextTurnNumber,
  worldId,
}: EndTurnControlProps): JSX.Element | null {
  if (!canAdmin) {
    return null;
  }

  return (
    <EndTurnControlContent
      currentDateLabel={currentDateLabel}
      currentTurnNumber={currentTurnNumber}
      isArchived={isArchived}
      nextDateLabel={nextDateLabel}
      nextTurnNumber={nextTurnNumber}
      worldId={worldId}
    />
  );
}

function EndTurnControlContent({
  currentDateLabel,
  currentTurnNumber,
  isArchived,
  nextDateLabel,
  nextTurnNumber,
  worldId,
}: {
  readonly currentDateLabel: string;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly worldId: string;
}): JSX.Element {
  const [isConfirming, setIsConfirming] = useState(false);
  const [successfulTransition, setSuccessfulTransition] =
    useState<SuccessfulEndTurnTransition | null>(null);
  const queryClient = useQueryClient();
  const readinessSummaryQuery = useQuery(
    settlementReadinessSummaryQueryOptions(worldId),
  );
  const endTurnMutation = useMutation(
    endTurnBasicMutationOptions({ queryClient }),
  );
  const isReadinessUnavailable = !readinessSummaryQuery.isSuccess;
  const isDisabled =
    isArchived || isReadinessUnavailable || endTurnMutation.isPending;

  function openConfirmation(): void {
    if (isDisabled) {
      return;
    }

    endTurnMutation.reset();
    setIsConfirming(true);
  }

  function submitEndTurn(): void {
    if (isDisabled) {
      return;
    }

    setSuccessfulTransition(null);
    endTurnMutation.mutate(
      {
        expectedTurnNumber: currentTurnNumber,
        worldId,
      },
      {
        onSuccess: (result) => {
          setIsConfirming(false);
          setSuccessfulTransition({
            nextDateLabel,
            nextTurnNumber: result.transition.nextTurnNumber,
            previousDateLabel: currentDateLabel,
            previousTurnNumber: result.transition.previousTurnNumber,
          });
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="end-turn-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="end-turn-title"
            className="text-lg font-semibold tracking-normal"
          >
            End turn
          </h2>
          <p className="text-sm text-muted-foreground">
            Advance the world from turn {currentTurnNumber} after reviewing
            settlement readiness.
          </p>
        </div>
        <Button
          disabled={isDisabled}
          onClick={openConfirmation}
          type="button"
          className="w-fit"
        >
          <StepForward aria-hidden="true" />
          {endTurnMutation.isPending ? "Ending turn..." : "End turn"}
        </Button>
      </div>

      {readinessSummaryQuery.isPending ? (
        <LoadingState label="Loading end-turn readiness..." />
      ) : null}

      {readinessSummaryQuery.isError ? (
        <ErrorState
          title="End-turn readiness could not be loaded"
          description={getErrorDescription(readinessSummaryQuery.error)}
        />
      ) : null}

      {readinessSummaryQuery.isSuccess ? (
        <dl className="grid gap-3 sm:grid-cols-4">
          <EndTurnMetric
            label="Current turn"
            value={currentTurnNumber.toString()}
          />
          <EndTurnMetric
            label="Ready"
            value={readinessSummaryQuery.data.readySettlementCount.toString()}
          />
          <EndTurnMetric
            label="Not ready"
            value={readinessSummaryQuery.data.notReadySettlementCount.toString()}
          />
          <EndTurnMetric
            label="Ready percent"
            value={`${readinessSummaryQuery.data.readyPercentage}%`}
          />
        </dl>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {getControlDescription({
          isArchived,
          isPending: endTurnMutation.isPending,
          isReadinessUnavailable,
        })}
      </p>

      {endTurnMutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {getErrorDescription(endTurnMutation.error)}
        </p>
      ) : null}

      {successfulTransition !== null ? (
        <EndTurnSuccessMessage transition={successfulTransition} />
      ) : null}

      {isConfirming && readinessSummaryQuery.isSuccess ? (
        <EndTurnConfirmationDialog
          currentDateLabel={currentDateLabel}
          currentTurnNumber={currentTurnNumber}
          isPending={endTurnMutation.isPending}
          nextDateLabel={nextDateLabel}
          nextTurnNumber={nextTurnNumber}
          onCancel={() => {
            setIsConfirming(false);
          }}
          onConfirm={submitEndTurn}
          readinessSummary={readinessSummaryQuery.data}
        />
      ) : null}
    </section>
  );
}

function EndTurnSuccessMessage({
  transition,
}: {
  readonly transition: SuccessfulEndTurnTransition;
}): JSX.Element {
  return (
    <div
      className="grid gap-3 rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
      role="status"
    >
      <p className="flex items-start gap-2 font-medium">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        End-turn transition completed.
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <EndTurnDetail
          label="Previous turn"
          value={`Turn ${transition.previousTurnNumber}`}
        />
        <EndTurnDetail
          label="New turn"
          value={`Turn ${transition.nextTurnNumber}`}
        />
        <EndTurnDetail
          label="Previous date"
          value={transition.previousDateLabel}
        />
        <EndTurnDetail label="New date" value={transition.nextDateLabel} />
      </dl>
    </div>
  );
}

function EndTurnDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EndTurnConfirmationDialog({
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
            value={`Turn ${currentTurnNumber}`}
          />
          <EndTurnMetric label="Next turn" value={`Turn ${nextTurnNumber}`} />
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

function EndTurnMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-normal">{value}</dd>
    </div>
  );
}

function getControlDescription({
  isArchived,
  isPending,
  isReadinessUnavailable,
}: {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly isReadinessUnavailable: boolean;
}): string {
  if (isArchived) {
    return "End turn is disabled because this world is archived.";
  }

  if (isReadinessUnavailable) {
    return "End turn is disabled until readiness can be reviewed.";
  }

  if (isPending) {
    return "End-turn transition is running.";
  }

  return "Submitting starts one end-turn transition for the current turn.";
}

function getReadinessSummaryDescription(
  readinessSummary: SettlementReadinessSummary,
): string {
  return `${readinessSummary.readySettlementCount} of ${readinessSummary.totalSettlementCount} settlements ready (${readinessSummary.readyPercentage}%). ${readinessSummary.notReadySettlementCount} not ready.`;
}

function getErrorDescription(error: unknown): string {
  if (isEndTurnBasicError(error)) {
    switch (error.code) {
      case "end_turn_archived_world":
        return "This world is archived. End turn is unavailable.";
      case "end_turn_running_transition":
        return "Another end-turn transition is already running. Refresh the page before trying again.";
      case "end_turn_stale_turn":
        return "This turn has already changed. Refresh the page to review the latest world state.";
      case "end_turn_unauthorized":
        return "End turn is unavailable for this world.";
    }
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
