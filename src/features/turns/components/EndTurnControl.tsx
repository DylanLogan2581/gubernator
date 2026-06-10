import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { AlertTriangle, StepForward } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { normalizeSignInReturnPath } from "@/features/auth";
import {
  formatSettlementReadinessPercentage,
  settlementReadinessSummaryQueryOptions,
} from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  endTurnTransitionMutationOptions,
  isEndTurnTransitionError,
} from "../mutations/endTurnTransitionMutations";
import {
  failStuckTurnTransitionMutationOptions,
  isFailStuckTurnTransitionError,
} from "../mutations/failStuckTurnTransitionMutations";
import { latestTurnTransitionStatusQueryOptions } from "../queries/latestTurnTransitionStatusQueries";
import {
  getControlDescription,
  getErrorDescription as getEndTurnMutationErrorDescription,
} from "../utils/endTurnDescriptions";

import { EndTurnConfirmationDialog } from "./EndTurnConfirmationDialog";
import { MetricTile } from "./EndTurnMetric";

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
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const readinessSummaryQuery = useQuery(
    settlementReadinessSummaryQueryOptions(worldId),
  );
  const latestTransitionQuery = useQuery(
    latestTurnTransitionStatusQueryOptions(worldId),
  );
  const endTurnMutation = useMutation(
    endTurnTransitionMutationOptions({ queryClient }),
  );
  const failStuckMutation = useMutation(
    failStuckTurnTransitionMutationOptions({ queryClient }),
  );
  const isReadinessUnavailable = !readinessSummaryQuery.isSuccess;
  const isDisabled =
    isArchived || isReadinessUnavailable || endTurnMutation.isPending;

  // Time-based check to detect stuck transitions — safe since the result depends only on the transition data.
  const isStuckRunning = (() => {
    const data = latestTransitionQuery.data;
    if (data?.isRunning !== true || data?.startedAt === undefined) {
      return false;
    }

    // eslint-disable-next-line no-restricted-syntax
    const startedTime = new Date(data.startedAt).getTime();
    // eslint-disable-next-line react-hooks/purity, no-restricted-syntax
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    return startedTime < thirtyMinutesAgo;
  })();

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
          if (
            isEndTurnTransitionError(error) &&
            error.code === "end_turn_session_expired"
          ) {
            const returnTo = normalizeSignInReturnPath(
              router.state.location.href,
            );
            void navigate({ to: "/sign-in", search: { returnTo } });
            return;
          }
          // Error shown in dialog banner instead of toast for high-stakes flow.
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

  function resetStuckTransition(): void {
    if (
      latestTransitionQuery.data?.id === undefined ||
      failStuckMutation.isPending
    ) {
      return;
    }

    failStuckMutation.mutate(
      {
        transitionId: latestTransitionQuery.data.id,
        worldId,
      },
      {
        onError: (error) => {
          if (isFailStuckTurnTransitionError(error)) {
            notifyMutationError(
              error,
              "Could not reset stuck transition. Check permissions and try again.",
            );
            return;
          }
          notifyMutationError(error, "Reset failed.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Stuck transition marked as failed", {
            description:
              "You can now try running the turn transition again with fresh state.",
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
          <MetricTile
            label="Current turn"
            value={currentTurnNumber.toString()}
          />
          <MetricTile
            label="Ready"
            value={readinessSummaryQuery.data.readySettlementCount.toString()}
          />
          <MetricTile
            label="Not ready"
            value={readinessSummaryQuery.data.notReadySettlementCount.toString()}
          />
          <MetricTile
            label="Ready percent"
            value={formatSettlementReadinessPercentage(
              readinessSummaryQuery.data.readyPercentage,
            )}
          />
        </dl>
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
