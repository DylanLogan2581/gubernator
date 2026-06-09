import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";
import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type { ApplyTurnTransitionPayload } from "./transition.ts";
import type {
  ApplyTurnTransitionSummary,
  EndTurnSimulationAuthContext,
  EndTurnSimulationErrorResponse,
  EndTurnSimulationPersistResult,
  EndTurnSimulationRequestBody,
} from "./types.ts";

type SupabaseRpcError = {
  readonly code: string;
  readonly hint?: string;
  readonly message: string;
};

type StartTurnTransitionResult =
  | {
      readonly ok: true;
      readonly transitionId: string;
    }
  | {
      readonly error: EndTurnSimulationErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

function isSupabaseRpcError(value: unknown): value is SupabaseRpcError {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isApplyTurnTransitionSummary(
  value: unknown,
): value is ApplyTurnTransitionSummary {
  return (
    isRecord(value) &&
    typeof value.transitionId === "string" &&
    typeof value.fromTurnNumber === "number" &&
    typeof value.toTurnNumber === "number" &&
    typeof value.currentTurnNumber === "number" &&
    isRecord(value.patchCounts)
  );
}

export async function startTurnTransition(
  body: EndTurnSimulationRequestBody,
  authContext: EndTurnSimulationAuthContext,
): Promise<StartTurnTransitionResult> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredRuntimeEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (supabaseUrl === undefined || supabaseServiceRoleKey === undefined) {
    return createStartUnavailableResult();
  }

  let response: Response;
  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 30000); // 30s timeout
    try {
      response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/start_turn_transition`,
        {
          body: JSON.stringify({
            p_expected_turn_number: body.expectedTurnNumber,
            p_initiated_by_user_id: authContext.userId,
            p_world_id: body.worldId,
          }),
          headers: {
            apikey: supabaseServiceRoleKey,
            authorization: `Bearer ${supabaseServiceRoleKey}`,
            "content-type": "application/json",
          },
          method: "POST",
          signal: abortController.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return createStartUnavailableResult();
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      return createStartUnavailableResult();
    }

    if (isSupabaseRpcError(errorBody)) {
      return rpcErrorToStartResult(errorBody);
    }

    return createStartUnavailableResult();
  }

  let transitionId: unknown;
  try {
    transitionId = await response.json();
  } catch {
    return createStartUnavailableResult();
  }

  if (typeof transitionId !== "string") {
    return createStartUnavailableResult();
  }

  return { ok: true, transitionId };
}

export async function persistSimulationTransition(
  body: EndTurnSimulationRequestBody,
  payload: ApplyTurnTransitionPayload,
  transitionId: string,
): Promise<EndTurnSimulationPersistResult> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredRuntimeEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (supabaseUrl === undefined || supabaseServiceRoleKey === undefined) {
    return createTransitionUnavailableResult();
  }

  let response: Response;
  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 30000); // 30s timeout
    try {
      response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/apply_turn_transition`,
        {
          body: JSON.stringify({
            p_expected_turn_number: body.expectedTurnNumber,
            p_payload: payload,
            p_transition_id: transitionId,
            p_world_id: body.worldId,
          }),
          headers: {
            apikey: supabaseServiceRoleKey,
            authorization: `Bearer ${supabaseServiceRoleKey}`,
            "content-type": "application/json",
          },
          method: "POST",
          signal: abortController.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return createTransitionUnavailableResult();
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      return createTransitionUnavailableResult();
    }

    if (isSupabaseRpcError(errorBody)) {
      return rpcErrorToResult(errorBody);
    }

    return createTransitionUnavailableResult();
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    return createTransitionUnavailableResult();
  }

  if (!isApplyTurnTransitionSummary(responseBody)) {
    return createTransitionUnavailableResult();
  }

  return { ok: true, summary: responseBody };
}

function rpcErrorToStartResult(
  error: SupabaseRpcError,
): StartTurnTransitionResult {
  if (error.code === "42501") {
    return {
      error: createErrorResponse({
        code: "unauthorized",
        message: "End turn is unavailable for this world.",
      }),
      ok: false,
      status: 403,
    };
  }

  if (error.code === "P0001") {
    if (error.hint === "world_archived") {
      return {
        error: createErrorResponse({
          code: "end_turn_world_archived",
          message: "World is archived and cannot be advanced.",
        }),
        ok: false,
        status: 409,
      };
    }

    if (error.hint === "stale_expected_turn") {
      return {
        error: createErrorResponse({
          code: "end_turn_stale_expected_turn",
          message: "Expected current turn no longer matches the world state.",
        }),
        ok: false,
        status: 409,
      };
    }

    return {
      error: createErrorResponse({
        code: "end_turn_transition_failed",
        message: "End turn persistence failed after the transition started.",
      }),
      ok: false,
      status: 500,
    };
  }

  return createStartUnavailableResult();
}

function rpcErrorToResult(
  error: SupabaseRpcError,
): EndTurnSimulationPersistResult {
  if (error.code === "42501") {
    return {
      error: createErrorResponse({
        code: "unauthorized",
        message: "End turn is unavailable for this world.",
      }),
      ok: false,
      status: 403,
    };
  }

  if (error.code === "P0001") {
    if (error.hint === "world_archived") {
      return {
        error: createErrorResponse({
          code: "end_turn_world_archived",
          message: "World is archived and cannot be advanced.",
        }),
        ok: false,
        status: 409,
      };
    }

    if (error.hint === "stale_expected_turn") {
      return {
        error: createErrorResponse({
          code: "end_turn_stale_expected_turn",
          message: "Expected current turn no longer matches the world state.",
        }),
        ok: false,
        status: 409,
      };
    }

    if (error.hint === "state_drifted") {
      return {
        error: createErrorResponse({
          code: "end_turn_state_drifted",
          message:
            "World state changed during end-turn processing. Refresh and retry.",
        }),
        ok: false,
        status: 409,
      };
    }

    return {
      error: createErrorResponse({
        code: "end_turn_transition_failed",
        message: "End turn persistence failed after the transition started.",
      }),
      ok: false,
      status: 500,
    };
  }

  return createTransitionUnavailableResult();
}

function createStartUnavailableResult(): StartTurnTransitionResult {
  return {
    error: createErrorResponse({
      code: "end_turn_transition_unavailable",
      message: "End turn transition could not be started.",
    }),
    ok: false,
    status: 500,
  };
}

function createTransitionUnavailableResult(): EndTurnSimulationPersistResult {
  return {
    error: createErrorResponse({
      code: "end_turn_transition_unavailable",
      message: "End turn transition could not be started.",
    }),
    ok: false,
    status: 500,
  };
}
