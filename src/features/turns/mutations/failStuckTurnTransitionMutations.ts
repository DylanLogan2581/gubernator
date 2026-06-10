import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { turnQueryKeys } from "../queries/turnQueryKeys";

type FailStuckTurnTransitionMutationOptions = UseMutationOptions<
  FailStuckTurnTransitionMutationResult,
  FailStuckTurnTransitionError,
  FailStuckTurnTransitionInput
>;

type FailStuckTurnTransitionErrorCode =
  | "fail_stuck_archived_world"
  | "fail_stuck_stale_transition"
  | "fail_stuck_transition_not_found"
  | "fail_stuck_transition_not_running"
  | "fail_stuck_unauthorized"
  | "fail_stuck_unknown_error";

type FailStuckTurnTransitionResult = {
  readonly markedFailedAt: string;
  readonly status: string;
  readonly transitionId: string;
  readonly worldId: string;
};

export type FailStuckTurnTransitionInput = {
  readonly transitionId: string;
  readonly worldId: string;
};

export type FailStuckTurnTransitionMutationResult = {
  readonly result: FailStuckTurnTransitionResult;
  readonly worldId: string;
};

export class FailStuckTurnTransitionError extends Error {
  readonly code: FailStuckTurnTransitionErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: FailStuckTurnTransitionErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "FailStuckTurnTransitionError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function failStuckTurnTransitionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): FailStuckTurnTransitionMutationOptions {
  return mutationOptions({
    mutationFn: (input: FailStuckTurnTransitionInput) =>
      failStuckTurnTransition(client, input),
    mutationKey: [...turnQueryKeys.all, "fail-stuck-turn-transition"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestTransitionStatus(input.worldId),
        }),
      ]);
    },
  });
}

export function isFailStuckTurnTransitionError(
  error: unknown,
): error is FailStuckTurnTransitionError {
  return error instanceof FailStuckTurnTransitionError;
}

async function failStuckTurnTransition(
  client: GubernatorSupabaseClient,
  input: FailStuckTurnTransitionInput,
): Promise<FailStuckTurnTransitionMutationResult> {
  try {
    const { data, error } = await client.rpc("fail_stuck_turn_transition", {
      p_world_id: input.worldId,
      p_transition_id: input.transitionId,
    });

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }

    if (data === null) {
      throw new FailStuckTurnTransitionError({
        code: "fail_stuck_unknown_error",
        message: "No response from fail_stuck_turn_transition RPC.",
        worldId: input.worldId,
      });
    }

    return {
      result: data as FailStuckTurnTransitionResult,
      worldId: input.worldId,
    };
  } catch (err) {
    const supabaseError = normalizeSupabaseError(err);

    // Map Supabase error codes to specific error codes
    const code = mapErrorCode(supabaseError.code);
    throw new FailStuckTurnTransitionError({
      code,
      message: supabaseError.message,
      worldId: input.worldId,
    });
  }
}

function mapErrorCode(
  code: string | undefined,
): FailStuckTurnTransitionErrorCode {
  switch (code) {
    case "42883": // function does not exist
      return "fail_stuck_unauthorized";
    case undefined:
      return "fail_stuck_unknown_error";
    default:
      return "fail_stuck_unknown_error";
  }
}
