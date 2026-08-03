import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { normalizeSignInReturnPath, type AuthUiError } from "@/features/auth";
import {
  getBlockingNations,
  nationReadinessListQueryOptions,
  type NationReadinessListItem,
} from "@/features/nations";
import {
  settlementReadinessSummaryQueryOptions,
  type SettlementReadinessSummary,
} from "@/features/settlements";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  endTurnTransitionMutationOptions,
  invalidateAfterTurnAdvance,
  isEndTurnTransitionError,
  type EndTurnTransitionError,
  type EndTurnTransitionInput,
  type EndTurnTransitionMutationResult,
} from "../mutations/endTurnTransitionMutations";
import {
  failStuckTurnTransitionMutationOptions,
  isFailStuckTurnTransitionError,
  type FailStuckTurnTransitionError,
  type FailStuckTurnTransitionInput,
  type FailStuckTurnTransitionMutationResult,
} from "../mutations/failStuckTurnTransitionMutations";
import {
  latestTurnTransitionStatusQueryOptions,
  type LatestTurnTransitionStatusError,
} from "../queries/latestTurnTransitionStatusQueries";

import type { LatestTurnTransitionStatus } from "../types/turnTransitionStatusTypes";

type UseEndTurnControlInput = {
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export type UseEndTurnControlResult = {
  readonly blockingNations: readonly NationReadinessListItem[];
  readonly closeConfirmation: () => void;
  readonly endTurnMutation: UseMutationResult<
    EndTurnTransitionMutationResult,
    EndTurnTransitionError,
    EndTurnTransitionInput
  >;
  readonly failStuckMutation: UseMutationResult<
    FailStuckTurnTransitionMutationResult,
    FailStuckTurnTransitionError,
    FailStuckTurnTransitionInput
  >;
  readonly isConfirming: boolean;
  readonly isDisabled: boolean;
  readonly isNationOverrideAcknowledged: boolean;
  readonly isReadinessUnavailable: boolean;
  readonly isStuckRunning: boolean;
  readonly isTurnRunning: boolean;
  readonly latestTransitionQuery: UseQueryResult<
    LatestTurnTransitionStatus | null,
    AuthUiError | LatestTurnTransitionStatusError
  >;
  readonly nationReadinessListQuery: UseQueryResult<
    readonly NationReadinessListItem[],
    AuthUiError
  >;
  readonly openConfirmation: () => void;
  readonly readinessSummaryQuery: UseQueryResult<
    SettlementReadinessSummary,
    AuthUiError
  >;
  readonly requiresNationOverrideConfirmation: boolean;
  readonly resetStuckTransition: () => void;
  readonly setIsNationOverrideAcknowledged: (acknowledged: boolean) => void;
  readonly submitEndTurn: () => void;
};

// Shared by the full EndTurnControl dashboard card (WorldShellPage) and the
// compact HeaderEndTurnControl chip (AppHeader) — one mutation/readiness
// state, two presentations (issue #1009).
export function useEndTurnControl({
  currentTurnNumber,
  isArchived,
  worldId,
}: UseEndTurnControlInput): UseEndTurnControlResult {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isNationOverrideAcknowledged, setIsNationOverrideAcknowledged] =
    useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const readinessSummaryQuery = useQuery(
    settlementReadinessSummaryQueryOptions(worldId),
  );
  const nationReadinessListQuery = useQuery(
    nationReadinessListQueryOptions(worldId),
  );
  const latestTransitionQuery = useQuery(
    latestTurnTransitionStatusQueryOptions(worldId),
  );
  const endTurnMutation = useMutation(
    endTurnTransitionMutationOptions({ queryClient }),
  );
  const failStuckMutation = useMutation(
    failStuckTurnTransitionMutationOptions({ queryClient }),
  );
  const isReadinessUnavailable =
    !readinessSummaryQuery.isSuccess || !nationReadinessListQuery.isSuccess;
  // The turn runs in a background worker now (#1278), so "in flight" outlives
  // the mutation: the request returns as soon as the job is queued.
  const isTurnRunning = latestTransitionQuery.data?.isRunning === true;
  const isDisabled =
    isArchived ||
    isReadinessUnavailable ||
    endTurnMutation.isPending ||
    isTurnRunning;
  const blockingNations = nationReadinessListQuery.isSuccess
    ? getBlockingNations(nationReadinessListQuery.data)
    : [];
  const requiresNationOverrideConfirmation = blockingNations.length > 0;

  // Time-based check to detect stuck transitions — safe since the result depends only on the transition data.
  const isStuckRunning = (() => {
    const data = latestTransitionQuery.data;
    if (data?.isRunning !== true || data?.startedAt === undefined) {
      return false;
    }

    // eslint-disable-next-line no-restricted-syntax
    const startedTime = new Date(data.startedAt).getTime();
    // eslint-disable-next-line react-hooks/purity, no-restricted-syntax
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    return startedTime < thirtyMinutesAgo;
  })();

  // The worker reports the outcome through the transition row, not through the
  // mutation response, so the success toast and the wide cache invalidation
  // fire here -- once, when the transition this control started goes terminal.
  const watchedTransitionIdRef = useRef<string | null>(null);
  const transition = latestTransitionQuery.data;

  useEffect(() => {
    const watchedId = watchedTransitionIdRef.current;

    if (
      watchedId === null ||
      transition === null ||
      transition === undefined ||
      transition.id !== watchedId ||
      transition.isRunning
    ) {
      return;
    }

    watchedTransitionIdRef.current = null;

    if (transition.state === "failed") {
      notifyMutationError(
        new Error("Turn advancement failed."),
        "The background turn run failed. Check the world state and try again.",
      );
      return;
    }

    void invalidateAfterTurnAdvance(queryClient, worldId).then(() => {
      notifyMutationSuccess(
        `Advanced to turn ${transition.toTurnNumber.toString()}`,
      );
    });
  }, [queryClient, transition, worldId]);

  function openConfirmation(): void {
    if (isDisabled) {
      return;
    }

    endTurnMutation.reset();
    setIsNationOverrideAcknowledged(false);
    setIsConfirming(true);
  }

  function closeConfirmation(): void {
    setIsConfirming(false);
  }

  function submitEndTurn(): void {
    if (isDisabled) {
      return;
    }

    if (requiresNationOverrideConfirmation && !isNationOverrideAcknowledged) {
      return;
    }

    endTurnMutation.mutate(
      {
        expectedTurnNumber: currentTurnNumber,
        worldId,
      },
      {
        onError: (error) => {
          if (
            isEndTurnTransitionError(error) &&
            error.code === "end_turn_session_expired"
          ) {
            const returnTo = normalizeSignInReturnPath(
              router.state.location.href,
            );
            void navigate({ to: "/sign-in", search: { returnTo } });
            return;
          }
          // Error shown in dialog banner instead of toast for high-stakes flow.
        },
        onSuccess: (result) => {
          setIsConfirming(false);
          watchedTransitionIdRef.current = result.transitionId;
          notifyMutationSuccess("Turn advancement started", {
            description:
              "The turn is running in the background. This page updates when it finishes.",
          });
        },
      },
    );
  }

  function resetStuckTransition(): void {
    if (
      latestTransitionQuery.data?.id === undefined ||
      failStuckMutation.isPending
    ) {
      return;
    }

    failStuckMutation.mutate(
      {
        transitionId: latestTransitionQuery.data.id,
        worldId,
      },
      {
        onError: (error) => {
          if (isFailStuckTurnTransitionError(error)) {
            notifyMutationError(
              error,
              "Could not reset stuck transition. Check permissions and try again.",
            );
            return;
          }
          notifyMutationError(error, "Reset failed.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Stuck transition marked as failed", {
            description:
              "You can now try running the turn transition again with fresh state.",
          });
        },
      },
    );
  }

  return {
    blockingNations,
    closeConfirmation,
    endTurnMutation,
    failStuckMutation,
    isConfirming,
    isDisabled,
    isNationOverrideAcknowledged,
    isReadinessUnavailable,
    isStuckRunning,
    isTurnRunning,
    latestTransitionQuery,
    nationReadinessListQuery,
    openConfirmation,
    readinessSummaryQuery,
    requiresNationOverrideConfirmation,
    resetStuckTransition,
    setIsNationOverrideAcknowledged,
    submitEndTurn,
  };
}
