import { StepForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EndTurnConfirmationDialog,
  getControlDescription,
  getEndTurnErrorDescription,
  useEndTurnControl,
} from "@/features/turns";

import type { JSX } from "react";

type HeaderEndTurnControlProps = {
  readonly canAdmin: boolean;
  readonly currentDateLabel: string;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly worldId: string;
};

// Compact header replacement for the full EndTurnControl dashboard card
// (issue #1009) — same mutation/readiness state via useEndTurnControl, a
// single-row-height button instead of a stat-tile section. The full card
// still renders on WorldShellPage for effective admins.
export function HeaderEndTurnControl({
  canAdmin,
  currentDateLabel,
  currentTurnNumber,
  isArchived,
  nextDateLabel,
  nextTurnNumber,
  worldId,
}: HeaderEndTurnControlProps): JSX.Element | null {
  const {
    blockingNations,
    closeConfirmation,
    endTurnMutation,
    isConfirming,
    isDisabled,
    isNationOverrideAcknowledged,
    isReadinessUnavailable,
    isTurnRunning,
    latestTransitionQuery,
    openConfirmation,
    readinessSummaryQuery,
    requiresNationOverrideConfirmation,
    setIsNationOverrideAcknowledged,
    submitEndTurn,
  } = useEndTurnControl({ currentTurnNumber, isArchived, worldId });

  if (!canAdmin) {
    return null;
  }

  const readinessSuffix = readinessSummaryQuery.isSuccess
    ? ` · ${readinessSummaryQuery.data.readySettlementCount.toString()}/${readinessSummaryQuery.data.totalSettlementCount.toString()} ready`
    : "";
  const disabledReason = getControlDescription({
    isArchived,
    isPending: endTurnMutation.isPending,
    isReadinessUnavailable,
    isTurnRunning,
    progressStage: latestTransitionQuery.data?.progressStage ?? null,
  });

  return (
    <>
      <Button
        disabled={isDisabled}
        onClick={openConfirmation}
        type="button"
        size="sm"
        title={disabledReason === "" ? undefined : disabledReason}
        // Bridged from the command palette's "End turn" action.
        data-command-palette-action="end-turn"
      >
        <StepForward aria-hidden="true" />
        <span className="truncate">
          {isTurnRunning || endTurnMutation.isPending ? (
            "Running..."
          ) : (
            <>
              End Turn
              <span className="hidden sm:inline">{readinessSuffix}</span>
            </>
          )}
        </span>
      </Button>

      {isConfirming && readinessSummaryQuery.isSuccess ? (
        <EndTurnConfirmationDialog
          blockingNations={blockingNations}
          currentDateLabel={currentDateLabel}
          currentTurnNumber={currentTurnNumber}
          errorMessage={
            endTurnMutation.isError
              ? getEndTurnErrorDescription(endTurnMutation.error)
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
    </>
  );
}
