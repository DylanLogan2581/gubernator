import {
  generateRequestId,
  logRequestEntry,
  logCaughtError,
  logRequestSuccess,
  logRequestFailure,
} from "../_shared/edgeRequestLogger.ts";
import {
  getRequiredRuntimeEnv,
  getRequiredRuntimeUrl,
} from "../_shared/http/env.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

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
  const requestId = generateRequestId();
  logRequestEntry(
    requestId,
    authContext.userId,
    "start_turn_transition",
    body.worldId,
  );

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredRuntimeEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (supabaseUrl === undefined || supabaseServiceRoleKey === undefined) {
    logRequestFailure(
      requestId,
      "end_turn_transition_unavailable",
      "Supabase configuration unavailable",
    );
    return createStartUnavailableResult();
  }

  let response: Response;
  try {
    response = await supabaseFetch(
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
      },
      30000,
    );
  } catch {
    logCaughtError(
      requestId,
      "fetch_error",
      "Failed to reach start_turn_transition RPC",
    );
    return createStartUnavailableResult();
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      logCaughtError(
        requestId,
        "response_parse_error",
        "Failed to parse error response",
      );
      return createStartUnavailableResult();
    }

    if (isSupabaseRpcError(errorBody)) {
      logCaughtError(
        requestId,
        errorBody.code,
        errorBody.message,
        errorBody.hint,
      );
      return rpcErrorToStartResult(errorBody, requestId);
    }

    logCaughtError(
      requestId,
      "unknown_error",
      "Unexpected error response format",
    );
    return createStartUnavailableResult();
  }

  let transitionId: unknown;
  try {
    transitionId = await response.json();
  } catch {
    logCaughtError(
      requestId,
      "response_parse_error",
      "Failed to parse transition ID response",
    );
    return createStartUnavailableResult();
  }

  if (typeof transitionId !== "string") {
    logCaughtError(
      requestId,
      "invalid_response_type",
      "Transition ID is not a string",
    );
    return createStartUnavailableResult();
  }

  logRequestSuccess(requestId, `Transition started: ${transitionId}`);
  return { ok: true, transitionId };
}

export async function persistSimulationTransition(
  body: EndTurnSimulationRequestBody,
  payload: ApplyTurnTransitionPayload,
  transitionId: string,
  actorUserId: string,
): Promise<EndTurnSimulationPersistResult> {
  const requestId = generateRequestId();
  logRequestEntry(
    requestId,
    actorUserId,
    "persist_simulation_transition",
    body.worldId,
  );

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredRuntimeEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (supabaseUrl === undefined || supabaseServiceRoleKey === undefined) {
    logRequestFailure(
      requestId,
      "end_turn_transition_unavailable",
      "Supabase configuration unavailable",
    );
    return createTransitionUnavailableResult();
  }

  let response: Response;
  try {
    response = await supabaseFetch(
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
      },
      30000,
    );
  } catch {
    logCaughtError(
      requestId,
      "fetch_error",
      "Failed to reach apply_turn_transition RPC",
    );
    return createTransitionUnavailableResult();
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      logCaughtError(
        requestId,
        "response_parse_error",
        "Failed to parse error response",
      );
      return createTransitionUnavailableResult();
    }

    if (isSupabaseRpcError(errorBody)) {
      logCaughtError(
        requestId,
        errorBody.code,
        errorBody.message,
        errorBody.hint,
      );
      return rpcErrorToResult(errorBody, requestId);
    }

    logCaughtError(
      requestId,
      "unknown_error",
      "Unexpected error response format",
    );
    return createTransitionUnavailableResult();
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    logCaughtError(
      requestId,
      "response_parse_error",
      "Failed to parse transition summary response",
    );
    return createTransitionUnavailableResult();
  }

  if (!isApplyTurnTransitionSummary(responseBody)) {
    logCaughtError(
      requestId,
      "invalid_response_format",
      "Response does not match ApplyTurnTransitionSummary",
    );
    return createTransitionUnavailableResult();
  }

  logRequestSuccess(
    requestId,
    `Transition persisted: ${responseBody.fromTurnNumber} -> ${responseBody.toTurnNumber}`,
  );
  return { ok: true, summary: responseBody };
}

function rpcErrorToStartResult(
  error: SupabaseRpcError,
  requestId: string,
): StartTurnTransitionResult {
  if (error.code === "42501") {
    logRequestFailure(requestId, "unauthorized", "RPC permission denied");
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
      logRequestFailure(requestId, "end_turn_world_archived", "World archived");
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
      logRequestFailure(
        requestId,
        "end_turn_stale_expected_turn",
        "Turn number mismatch",
      );
      return {
        error: createErrorResponse({
          code: "end_turn_stale_expected_turn",
          message: "Expected current turn no longer matches the world state.",
        }),
        ok: false,
        status: 409,
      };
    }

    logRequestFailure(
      requestId,
      "end_turn_transition_failed",
      "RPC business logic error",
    );
    return {
      error: createErrorResponse({
        code: "end_turn_transition_failed",
        message: "End turn persistence failed after the transition started.",
      }),
      ok: false,
      status: 500,
    };
  }

  logRequestFailure(
    requestId,
    "end_turn_transition_unavailable",
    "Unknown RPC error",
  );
  return createStartUnavailableResult();
}

function rpcErrorToResult(
  error: SupabaseRpcError,
  requestId: string,
): EndTurnSimulationPersistResult {
  if (error.code === "42501") {
    logRequestFailure(requestId, "unauthorized", "RPC permission denied");
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
      logRequestFailure(requestId, "end_turn_world_archived", "World archived");
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
      logRequestFailure(
        requestId,
        "end_turn_stale_expected_turn",
        "Turn number mismatch",
      );
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
      logRequestFailure(
        requestId,
        "end_turn_state_drifted",
        "State divergence",
      );
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

    logRequestFailure(
      requestId,
      "end_turn_transition_failed",
      "RPC business logic error",
    );
    return {
      error: createErrorResponse({
        code: "end_turn_transition_failed",
        message: "End turn persistence failed after the transition started.",
      }),
      ok: false,
      status: 500,
    };
  }

  logRequestFailure(
    requestId,
    "end_turn_transition_unavailable",
    "Unknown RPC error",
  );
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
