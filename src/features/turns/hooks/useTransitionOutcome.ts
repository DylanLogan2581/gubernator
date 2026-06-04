import { useQuery } from "@tanstack/react-query";

import {
  latestSettlementTransitionOutcomeQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
  type TurnTransitionOutcome,
} from "../queries/turnTransitionOutcomeQueries";

export function useSettlementTransitionOutcome(
  settlementId: string,
): TurnTransitionOutcome | null {
  const { data } = useQuery(
    latestSettlementTransitionOutcomeQueryOptions(settlementId),
  );
  return data ?? null;
}

export function useWorldTransitionOutcome(
  worldId: string,
): TurnTransitionOutcome | null {
  const { data } = useQuery(latestWorldTransitionOutcomeQueryOptions(worldId));
  return data ?? null;
}
