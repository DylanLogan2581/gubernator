import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StepForward } from "lucide-react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { settlementReadinessSummaryQueryOptions } from "@/features/settlements";

import {
  endTurnBasicMutationOptions,
  isEndTurnBasicError,
} from "../mutations/endTurnBasicMutations";

import type { JSX } from "react";

type EndTurnControlProps = {
  readonly canAdmin: boolean;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function EndTurnControl({
  canAdmin,
  currentTurnNumber,
  isArchived,
  worldId,
}: EndTurnControlProps): JSX.Element | null {
  if (!canAdmin) {
    return null;
  }

  return (
    <EndTurnControlContent
      currentTurnNumber={currentTurnNumber}
      isArchived={isArchived}
      worldId={worldId}
    />
  );
}

function EndTurnControlContent({
  currentTurnNumber,
  isArchived,
  worldId,
}: {
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
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

  function submitEndTurn(): void {
    if (isDisabled) {
      return;
    }

    endTurnMutation.mutate({
      expectedTurnNumber: currentTurnNumber,
      worldId,
    });
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
          onClick={submitEndTurn}
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
    </section>
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

function getErrorDescription(error: unknown): string {
  if (isEndTurnBasicError(error) || error instanceof Error) {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
