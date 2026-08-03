import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { invalidateAfterTurnAdvance } from "../mutations/endTurnTransitionMutations";
import { latestTurnTransitionStatusQueryOptions } from "../queries/latestTurnTransitionStatusQueries";

import type { TurnTransitionProgressStage } from "../types/turnTransitionStatusTypes";

export type WorldTurnPauseState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "running";
      readonly stage: TurnTransitionProgressStage | null;
      readonly startedAt: string;
      readonly toTurnNumber: number;
    }
  | { readonly kind: "acknowledge"; readonly toTurnNumber: number }
  | { readonly kind: "failed"; readonly toTurnNumber: number };

export type UseWorldTurnPauseResult = {
  readonly acknowledge: () => void;
  readonly state: WorldTurnPauseState;
};

export function useWorldTurnPause(worldId: string): UseWorldTurnPauseResult {
  const queryClient = useQueryClient();
  const statusQuery = useQuery(latestTurnTransitionStatusQueryOptions(worldId));
  const transition = statusQuery.data ?? null;

  // Session-local: a client that never saw the run does not get an
  // acknowledgment prompt. Someone opening the app three turns later just sees
  // the current turn, and there is no backlog of stale acknowledgments.
  const observedRunningRef = useRef(false);
  const [acknowledgedTurn, setAcknowledgedTurn] = useState<number | null>(null);

  const isRunning = transition?.isRunning ?? false;

  useEffect(() => {
    if (isRunning) {
      observedRunningRef.current = true;
    }
  }, [isRunning]);

  const acknowledge = useCallback(() => {
    if (transition === null) {
      return;
    }

    observedRunningRef.current = false;
    setAcknowledgedTurn(transition.toTurnNumber);
    void invalidateAfterTurnAdvance(queryClient, worldId);
  }, [queryClient, transition, worldId]);

  return { acknowledge, state: resolveState() };

  function resolveState(): WorldTurnPauseState {
    if (transition === null) {
      return { kind: "idle" };
    }

    if (transition.isRunning) {
      return {
        kind: "running",
        stage: transition.progressStage,
        startedAt: transition.startedAt,
        toTurnNumber: transition.toTurnNumber,
      };
    }

    // A failed transition may have partially applied, so players stay blocked
    // rather than being handed a "continue" that compounds the damage.
    if (transition.state === "failed") {
      return { kind: "failed", toTurnNumber: transition.toTurnNumber };
    }

    if (
      observedRunningRef.current &&
      acknowledgedTurn !== transition.toTurnNumber
    ) {
      return { kind: "acknowledge", toTurnNumber: transition.toTurnNumber };
    }

    return { kind: "idle" };
  }
}
