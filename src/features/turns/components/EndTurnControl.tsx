import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StepForward } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  formatSettlementReadinessPercentage,
  settlementReadinessSummaryQueryOptions,
} from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { endTurnTransitionMutationOptions } from "../mutations/endTurnTransitionMutations";
import {
  getControlDescription,
  getErrorDescription as getEndTurnMutationErrorDescription,
} from "../utils/endTurnDescriptions";

import { EndTurnConfirmationDialog } from "./EndTurnConfirmationDialog";
import { EndTurnMetric } from "./EndTurnMetric";

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
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();
  const readinessSummaryQuery = useQuery(
    settlementReadinessSummaryQueryOptions(worldId),
  );
  const endTurnMutation = useMutation(
    endTurnTransitionMutationOptions({ queryClient }),
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

    endTurnMutation.mutate(
      {
        expectedTurnNumber: currentTurnNumber,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "End turn failed.");
        },
        onSuccess: (result) => {
          setIsConfirming(false);
          const { patchCounts, toTurnNumber } = result.summary;
          const deaths = patchCounts.citizenDeaths;
          const births = patchCounts.citizenBirths;
          const buildingChanges = patchCounts.buildingStateChanges;
          const depositUpdates = patchCounts.depositUpdates;
          notifyMutationSuccess(`Advanced to turn ${toTurnNumber.toString()}`, {
            description: `${deaths.toString()} deaths, ${births.toString()} births, ${buildingChanges.toString()} building changes, ${depositUpdates.toString()} deposit updates.`,
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
            Run turn transition
          </h2>
          <p className="text-sm text-muted-foreground">
            Run the full simulation and advance the world from turn{" "}
            {currentTurnNumber}.
          </p>
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
            value={formatSettlementReadinessPercentage(
              readinessSummaryQuery.data.readyPercentage,
            )}
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

      {isConfirming && readinessSummaryQuery.isSuccess ? (
        <EndTurnConfirmationDialog
          currentDateLabel={currentDateLabel}
          currentTurnNumber={currentTurnNumber}
          errorMessage={
            endTurnMutation.isError
              ? getEndTurnMutationErrorDescription(endTurnMutation.error)
              : undefined
          }
          isPending={endTurnMutation.isPending}
          nextDateLabel={nextDateLabel}
          nextTurnNumber={nextTurnNumber}
          onClose={() => {
            setIsConfirming(false);
          }}
          onConfirm={submitEndTurn}
          readinessSummary={readinessSummaryQuery.data}
        />
      ) : null}
    </section>
  );
}
