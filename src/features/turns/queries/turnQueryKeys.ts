import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const turnQueryKeys = {
  all: authStateQueryCacheKeys.turnsAll,
  currentTurnState: (worldId: string) =>
    [...turnQueryKeys.all, "current-turn-state", worldId] as const,
  latestTransitionStatus: (worldId: string) =>
    [...turnQueryKeys.all, "latest-transition-status", worldId] as const,
} as const;
