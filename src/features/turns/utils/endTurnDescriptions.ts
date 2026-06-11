import {
  formatSettlementReadinessPercentage,
  type SettlementReadinessSummary,
} from "@/features/settlements";

import { isEndTurnTransitionError } from "../mutations/endTurnTransitionMutations";

export function getControlDescription({
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

  return "";
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
