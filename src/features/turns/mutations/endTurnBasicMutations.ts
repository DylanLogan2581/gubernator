import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { calendarQueryKeys } from "@/features/calendar";
import { notificationQueryKeys } from "@/features/notifications";
import { settlementReadinessQueryKeys } from "@/features/settlements";
import { worldQueryKeys } from "@/features/worlds";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { turnQueryKeys } from "../queries/turnQueryKeys";

type EndTurnBasicMutationOptions = UseMutationOptions<
  EndTurnBasicMutationResult,
  EndTurnBasicError,
  EndTurnBasicInput
>;
type EndTurnBasicExpectedErrorCode =
  | "end_turn_archived_world"
  | "end_turn_running_transition"
  | "end_turn_stale_turn"
  | "end_turn_transition_failed"
  | "end_turn_unauthorized";
type EndTurnBasicFunctionErrorCode =
  | "end_turn_running_transition"
  | "end_turn_stale_expected_turn"
  | "end_turn_transition_failed"
  | "end_turn_transition_unavailable"
  | "end_turn_world_archived"
  | "end_turn_world_not_found"
  | "unauthorized";
type EndTurnBasicFunctionResponse =
  | EndTurnBasicFunctionErrorResponse
  | EndTurnBasicFunctionSuccessResponse;
type EndTurnBasicFunctionErrorResponse = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly ok: false;
};
type EndTurnBasicFunctionSuccessResponse = {
  readonly data: EndTurnBasicMutationResult;
  readonly ok: true;
};

export type EndTurnBasicInput = {
  readonly expectedTurnNumber: number;
  readonly worldId: string;
};

export type EndTurnBasicMutationResult = {
  readonly actorId: string;
  readonly transition: {
    readonly nextTurnNumber: number;
    readonly previousTurnNumber: number;
  };
  readonly worldId: string;
};

export class EndTurnBasicError extends Error {
  readonly code: EndTurnBasicExpectedErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: EndTurnBasicExpectedErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "EndTurnBasicError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function endTurnBasicMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): EndTurnBasicMutationOptions {
  return mutationOptions({
    mutationFn: (input: EndTurnBasicInput) => endTurnBasic(client, input),
    mutationKey: [...turnQueryKeys.all, "end-turn-basic"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: worldQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.currentTurnState(input.worldId),
        }),
        queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: settlementReadinessQueryKeys.list(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: settlementReadinessQueryKeys.summary(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestTransitionStatus(input.worldId),
        }),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all }),
      ]);
    },
  });
}

export function isEndTurnBasicError(
  error: unknown,
): error is EndTurnBasicError {
  return error instanceof EndTurnBasicError;
}

async function endTurnBasic(
  client: GubernatorSupabaseClient,
  input: EndTurnBasicInput,
): Promise<EndTurnBasicMutationResult> {
  const response = await client.functions.invoke<unknown>("end-turn-basic", {
    body: {
      expectedTurnNumber: input.expectedTurnNumber,
      worldId: input.worldId,
    },
  });

  if (response.error !== null) {
    const errorResponse = await readFunctionErrorResponse(response.error);

    if (errorResponse !== null) {
      throw toEndTurnBasicError(errorResponse.error, input.worldId);
    }

    throw new EndTurnBasicError({
      code: "end_turn_transition_failed",
      message: "End turn transition could not be started.",
      worldId: input.worldId,
    });
  }

  if (isEndTurnBasicFunctionResponse(response.data)) {
    if (response.data.ok) {
      return response.data.data;
    }

    throw toEndTurnBasicError(response.data.error, input.worldId);
  }

  throw new EndTurnBasicError({
    code: "end_turn_transition_failed",
    message: "End turn transition response was invalid.",
    worldId: input.worldId,
  });
}

async function readFunctionErrorResponse(
  error: unknown,
): Promise<EndTurnBasicFunctionErrorResponse | null> {
  const context = getFunctionErrorContext(error);

  if (context === null) {
    return null;
  }

  try {
    const payload: unknown = await context.json();

    if (isEndTurnBasicFunctionErrorResponse(payload)) {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}

function getFunctionErrorContext(error: unknown): ResponseJsonReader | null {
  if (!isRecord(error)) {
    return null;
  }

  const context = error.context;

  if (isResponseJsonReader(context)) {
    return context;
  }

  return null;
}

function toEndTurnBasicError(
  error: EndTurnBasicFunctionErrorResponse["error"],
  worldId: string,
): EndTurnBasicError {
  return new EndTurnBasicError({
    code: normalizeEndTurnBasicErrorCode(error.code),
    message: error.message,
    worldId,
  });
}

function normalizeEndTurnBasicErrorCode(
  code: string,
): EndTurnBasicExpectedErrorCode {
  switch (code as EndTurnBasicFunctionErrorCode) {
    case "end_turn_stale_expected_turn":
      return "end_turn_stale_turn";
    case "unauthorized":
    case "end_turn_world_not_found":
      return "end_turn_unauthorized";
    case "end_turn_world_archived":
      return "end_turn_archived_world";
    case "end_turn_running_transition":
      return "end_turn_running_transition";
    case "end_turn_transition_failed":
    case "end_turn_transition_unavailable":
      return "end_turn_transition_failed";
  }

  return "end_turn_transition_failed";
}

function isEndTurnBasicFunctionResponse(
  value: unknown,
): value is EndTurnBasicFunctionResponse {
  return (
    isEndTurnBasicFunctionSuccessResponse(value) ||
    isEndTurnBasicFunctionErrorResponse(value)
  );
}

function isEndTurnBasicFunctionSuccessResponse(
  value: unknown,
): value is EndTurnBasicFunctionSuccessResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    isEndTurnBasicMutationResult(value.data)
  );
}

function isEndTurnBasicFunctionErrorResponse(
  value: unknown,
): value is EndTurnBasicFunctionErrorResponse {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function isEndTurnBasicMutationResult(
  value: unknown,
): value is EndTurnBasicMutationResult {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    isRecord(value.transition) &&
    typeof value.transition.nextTurnNumber === "number" &&
    typeof value.transition.previousTurnNumber === "number" &&
    typeof value.worldId === "string"
  );
}

type ResponseJsonReader = {
  readonly json: () => Promise<unknown>;
};

function isResponseJsonReader(value: unknown): value is ResponseJsonReader {
  return isRecord(value) && typeof value.json === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
