import {
  formatSettlementReadinessPercentage,
  type SettlementReadinessSummary,
} from "@/features/settlements";

import { isEndTurnTransitionError } from "../mutations/endTurnTransitionMutations";

import type { TurnTransitionProgressStage } from "../types/turnTransitionStatusTypes";

export function getControlDescription({
  isArchived,
  isPending,
  isReadinessUnavailable,
  isTurnRunning = false,
  progressStage = null,
}: {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly isReadinessUnavailable: boolean;
  readonly isTurnRunning?: boolean;
  readonly progressStage?: TurnTransitionProgressStage | null;
}): string {
  if (isArchived) {
    return "End turn is disabled because this world is archived.";
  }

  if (isReadinessUnavailable) {
    return "End turn is disabled until readiness can be reviewed.";
  }

  // The turn runs in a background worker (#1278), so it outlives the request
  // that queued it: describe the transition, not the mutation.
  if (isTurnRunning) {
    return `End-turn transition is running in the background (${getTurnProgressLabel(progressStage)}).`;
  }

  if (isPending) {
    return "Queueing the end-turn transition.";
  }

  return "";
}

export function getTurnProgressLabel(
  stage: TurnTransitionProgressStage | null,
): string {
  if (stage === "loading") {
    return "loading world state";
  }

  if (stage === "persisting") {
    return "saving results";
  }

  if (stage === "queued" || stage === null) {
    return "waiting to start";
  }

  // Everything else is a per-phase simulation stage (#1400). This label stays
  // coarse; the pause overlay is where individual phases are named.
  return "simulating the turn";
}

// Coarse, monotonic progress for the bar. The worker reports stages, not
// percentages, so these are presentational anchors rather than measurements.
export function getTurnProgressPercentage(
  stage: TurnTransitionProgressStage | null,
): number {
  if (stage === "loading") {
    return 35;
  }

  if (stage === "persisting") {
    return 90;
  }

  if (stage === "queued" || stage === null) {
    return 10;
  }

  return 70;
}

export function getReadinessSummaryDescription(
  readinessSummary: SettlementReadinessSummary,
): string {
  const readyPercentageLabel = formatSettlementReadinessPercentage(
    readinessSummary.readyPercentage,
  );

  return `${readinessSummary.readySettlementCount} of ${readinessSummary.totalSettlementCount} settlements ready (${readyPercentageLabel}). ${readinessSummary.notReadySettlementCount} not ready.`;
}

export function getErrorDescription(error: unknown): string {
  if (isEndTurnTransitionError(error)) {
    switch (error.code) {
      case "end_turn_archived_world":
        return "This world is archived. End turn is unavailable.";
      case "end_turn_running_transition":
        return "Another end-turn transition is already running. Refresh the page before trying again.";
      case "end_turn_session_expired":
        return "Your session has expired. Please sign in again.";
      case "end_turn_stale_turn":
        return "This turn has already changed. Refresh the page to review the latest world state.";
      case "end_turn_transition_failed":
        return "End turn could not be saved. Refresh the page before trying again.";
      case "end_turn_unauthorized":
        return "End turn is unavailable for this world.";
    }
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
