import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const turnQueryKeys = {
  all: authStateQueryCacheKeys.turnsAll,
  currentTurnState: (worldId: string) =>
    [...turnQueryKeys.all, "current-turn-state", worldId] as const,
  latestTransitionStatus: (worldId: string) =>
    [...turnQueryKeys.all, "latest-transition-status", worldId] as const,
  latestTransitionOutcome: (worldId: string) =>
    [...turnQueryKeys.all, "latest-transition-outcome", worldId] as const,
  latestSettlementTransitionOutcome: (settlementId: string) =>
    [
      ...turnQueryKeys.all,
      "latest-settlement-transition-outcome",
      settlementId,
    ] as const,
  latestSettlementTransitionOutcomeAll: () =>
    [...turnQueryKeys.all, "latest-settlement-transition-outcome"] as const,
  turnLogBrowser: (
    worldId: string,
    filter: Record<string, unknown>,
    page: number,
  ) =>
    [...turnQueryKeys.all, "turn-log-browser", worldId, filter, page] as const,
} as const;
