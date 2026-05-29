import type { SettlementReadinessState } from "../utils/settlementReadinessState";

export function getReadinessStateLabel(
  state: SettlementReadinessState,
): string {
  switch (state.kind) {
    case "auto-ready":
      return "Auto-ready";
    case "manually-ready":
      return "Ready";
    case "not-ready":
      return "Not ready";
  }
}

export function getManualReadinessLabel(
  state: SettlementReadinessState,
): string {
  switch (state.kind) {
    case "auto-ready":
      return "Ready (auto-ready)";
    case "manually-ready":
      return "Ready";
    case "not-ready":
      return "Not ready";
  }
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
