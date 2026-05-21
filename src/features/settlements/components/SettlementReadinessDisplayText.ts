import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";

export function getReadinessStateLabel(
  item: SettlementReadinessListItem,
): string {
  if (item.autoReadyEnabled) {
    return "Auto-ready";
  }

  if (item.isReadyForCurrentTurn) {
    return "Ready";
  }

  return "Not ready";
}

export function getManualReadinessLabel(
  item: SettlementReadinessListItem,
): string {
  if (item.autoReadyEnabled) {
    return "Ready (auto-ready)";
  }

  return item.isReadyForCurrentTurn ? "Ready" : "Not ready";
}

export function getManualReadinessDescription({
  isArchived,
  isAutoReady,
  isPending,
}: {
  readonly isArchived: boolean;
  readonly isAutoReady: boolean;
  readonly isPending: boolean;
}): string {
  if (isArchived) {
    return "Manual readiness is disabled because this world is archived.";
  }

  if (isAutoReady) {
    return "Auto-ready is enabled, so this settlement counts as ready without manual readiness.";
  }

  if (isPending) {
    return "Saving manual readiness.";
  }

  return "Toggle whether this settlement is ready for the current turn.";
}

export function getAutoReadyDescription({
  isArchived,
  isPending,
}: {
  readonly isArchived: boolean;
  readonly isPending: boolean;
}): string {
  if (isArchived) {
    return "Auto-ready is disabled because this world is archived.";
  }

  if (isPending) {
    return "Saving auto-ready.";
  }

  return "Automatically count this settlement as ready for each turn.";
}

export function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
