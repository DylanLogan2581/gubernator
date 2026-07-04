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
          queryKey: turnQueryKeys.currentTurnState(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestTransitionStatus(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestTransitionOutcome(input.worldId),
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

    // Map Supabase error code + message to a specific error code.
    const code = mapErrorCode(supabaseError);
    throw new FailStuckTurnTransitionError({
      code,
      message: supabaseError.message,
      worldId: input.worldId,
    });
  }
}

function mapErrorCode({
  code,
  message,
}: {
  readonly code?: string;
  readonly message: string;
}): FailStuckTurnTransitionErrorCode {
  if (code === "42501") {
    return "fail_stuck_unauthorized";
  }

  if (code === "P0001") {
    if (message.includes("archived")) {
      return "fail_stuck_archived_world";
    }
    if (message.includes("not found for world")) {
      return "fail_stuck_transition_not_found";
    }
    if (message.includes("not in running status")) {
      return "fail_stuck_transition_not_running";
    }
    if (message.includes("advanced past") || message.includes("stale")) {
      return "fail_stuck_stale_transition";
    }
  }

  // Covers 42883 (function does not exist / RPC not deployed) and any other
  // unrecognized Postgres error: report honestly as unknown rather than
  // guessing at a more specific (and potentially misleading) code.
  return "fail_stuck_unknown_error";
}
