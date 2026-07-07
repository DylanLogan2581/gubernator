import { AlertTriangle, StepForward } from "lucide-react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getErrorDescription } from "@/lib/errorUtils";

import { useEndTurnControl } from "../hooks/useEndTurnControl";
import {
  getControlDescription,
  getErrorDescription as getEndTurnMutationErrorDescription,
} from "../utils/endTurnDescriptions";

import { EndTurnConfirmationDialog } from "./EndTurnConfirmationDialog";
import { MetricTile } from "./EndTurnMetric";
import { NationReadinessList } from "./NationReadinessList";

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
  const {
    blockingNations,
    closeConfirmation,
    endTurnMutation,
    failStuckMutation,
    isConfirming,
    isDisabled,
    isNationOverrideAcknowledged,
    isReadinessUnavailable,
    isStuckRunning,
    nationReadinessListQuery,
    openConfirmation,
    readinessSummaryQuery,
    requiresNationOverrideConfirmation,
    resetStuckTransition,
    setIsNationOverrideAcknowledged,
    submitEndTurn,
  } = useEndTurnControl({ currentTurnNumber, isArchived, worldId });

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
            Run turn transition
          </h2>
        </div>
        <Button
          disabled={isDisabled}
          onClick={openConfirmation}
          type="button"
          className="w-fit"
        >
          <StepForward aria-hidden="true" />
          {endTurnMutation.isPending ? "Running..." : "Run turn transition"}
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
        <dl className="grid gap-3 sm:w-fit sm:grid-cols-1">
          <MetricTile
            label="Current turn"
            value={currentTurnNumber.toString()}
          />
        </dl>
      ) : null}

      {nationReadinessListQuery.isSuccess ? (
        <NationReadinessList items={nationReadinessListQuery.data} />
      ) : null}

      {isStuckRunning ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stuck turn transition detected</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>
              The turn transition has been running for over 30 minutes,
              suggesting it may be wedged by a validation failure. You can reset
              it to try again with fresh state.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={resetStuckTransition}
              disabled={failStuckMutation.isPending}
            >
              {failStuckMutation.isPending
                ? "Resetting..."
                : "Reset transition"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {getControlDescription({
          isArchived,
          isPending: endTurnMutation.isPending,
          isReadinessUnavailable,
        })}
      </p>

      {isConfirming && readinessSummaryQuery.isSuccess ? (
        <EndTurnConfirmationDialog
          blockingNations={blockingNations}
          currentDateLabel={currentDateLabel}
          currentTurnNumber={currentTurnNumber}
          errorMessage={
            endTurnMutation.isError
              ? getEndTurnMutationErrorDescription(endTurnMutation.error)
              : undefined
          }
          isNationOverrideAcknowledged={isNationOverrideAcknowledged}
          isPending={endTurnMutation.isPending}
          nextDateLabel={nextDateLabel}
          nextTurnNumber={nextTurnNumber}
          onClose={closeConfirmation}
          onConfirm={submitEndTurn}
          onNationOverrideAcknowledgedChange={setIsNationOverrideAcknowledged}
          readinessSummary={readinessSummaryQuery.data}
          requiresNationOverrideConfirmation={
            requiresNationOverrideConfirmation
          }
        />
      ) : null}
    </section>
  );
}
