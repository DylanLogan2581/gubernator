import {
  generateRequestId,
  logCaughtError,
  logRequestEntry,
  logRequestFailure,
  logRequestSuccess,
} from "../_shared/edgeRequestLogger.ts";
import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type { ForecastSnapshot } from "./forecast.ts";
import type { ApplyTurnTransitionPayload } from "./transition.ts";
import type {
  ApplyTurnTransitionSummary,
  EndTurnSimulationAuthContext,
  EndTurnSimulationErrorResponse,
  EndTurnSimulationPersistResult,
  EndTurnSimulationRequestBody,
} from "./types.ts";

// Matches the synchronous request budget. The background turn worker overrides
// it: applying a large world's turn is one long transaction that can outlast
// any request-shaped timeout (#1278).
const DEFAULT_RPC_TIMEOUT_MS = 30_000;

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

type EnqueueTurnJobResult =
  | {
    readonly jobId: string;
    readonly ok: true;
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
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
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
      timeoutMs,
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

// #1278: hand the turn to the background worker instead of running it inline.
// Called with the requester's JWT, not the service-role key: enqueue_turn_job
// authorizes through is_super_admin()/is_world_admin(), which need an auth.uid().
export async function enqueueTurnJob(
  body: EndTurnSimulationRequestBody,
  authContext: EndTurnSimulationAuthContext,
  transitionId: string,
): Promise<EnqueueTurnJobResult> {
  const requestId = generateRequestId();
  logRequestEntry(requestId, authContext.userId, "enqueue_turn_job", body.worldId);

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");
  const authorizationHeader = authContext.authorizationHeader;

  if (
    supabaseUrl === undefined ||
    supabaseAnonKey === undefined ||
    authorizationHeader === undefined
  ) {
    logRequestFailure(
      requestId,
      "end_turn_transition_unavailable",
      "Supabase configuration unavailable",
    );
    return createEnqueueUnavailableResult();
  }

  let response: Response;
  try {
    response = await supabaseFetch(
      `${supabaseUrl}/rest/v1/rpc/enqueue_turn_job`,
      {
        body: JSON.stringify({
          p_expected_turn_number: body.expectedTurnNumber,
          p_turn_transition_id: transitionId,
          p_world_id: body.worldId,
        }),
        headers: {
          apikey: supabaseAnonKey,
          authorization: authorizationHeader,
          "content-type": "application/json",
        },
        method: "POST",
      },
      30000,
    );
  } catch {
    logCaughtError(requestId, "fetch_error", "Failed to reach enqueue_turn_job RPC");
    return createEnqueueUnavailableResult();
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => undefined);

    if (isSupabaseRpcError(errorBody)) {
      logCaughtError(requestId, errorBody.code, errorBody.message, errorBody.hint);
      return rpcErrorToEnqueueResult(errorBody, requestId);
    }

    logCaughtError(requestId, "unknown_error", "Unexpected error response format");
    return createEnqueueUnavailableResult();
  }

  let jobId: unknown;
  try {
    jobId = await response.json();
  } catch {
    logCaughtError(requestId, "response_parse_error", "Failed to parse job id response");
    return createEnqueueUnavailableResult();
  }

  if (typeof jobId !== "string") {
    logCaughtError(requestId, "invalid_response_type", "Job id is not a string");
    return createEnqueueUnavailableResult();
  }

  logRequestSuccess(requestId, `Turn job enqueued: ${jobId}`);
  return { jobId, ok: true };
}

export async function persistSimulationTransition(
  body: EndTurnSimulationRequestBody,
  payload: ApplyTurnTransitionPayload,
  transitionId: string,
  actorUserId: string,
  forecastSnapshot: ForecastSnapshot,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
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
          p_forecast_snapshot_jsonb: forecastSnapshot,
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
      timeoutMs,
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

// Best-effort recovery path for #958: if plan/persist fails after
// startTurnTransition already wrote a 'running' row, mark that row failed
// via the same service-role RPC the superadmin recovery UI uses
// (fail_stuck_turn_transition) so the world is immediately advanceable
// again. Never throws — a failure here must not mask the original error
// that triggered the cleanup attempt.
export async function failStuckTurnTransition(
  worldId: string,
  transitionId: string,
  actorUserId: string,
  reason: string,
): Promise<void> {
  const requestId = generateRequestId();
  logRequestEntry(requestId, actorUserId, "fail_stuck_turn_transition", worldId);

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
    return;
  }

  let response: Response;
  try {
    response = await supabaseFetch(
      `${supabaseUrl}/rest/v1/rpc/fail_stuck_turn_transition`,
      {
        body: JSON.stringify({
          p_reason: reason,
          p_transition_id: transitionId,
          p_world_id: worldId,
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
      "Failed to reach fail_stuck_turn_transition RPC",
    );
    return;
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => undefined);
    if (isSupabaseRpcError(errorBody)) {
      logCaughtError(requestId, errorBody.code, errorBody.message, errorBody.hint);
    } else {
      logCaughtError(
        requestId,
        "unknown_error",
        "Unexpected error response format",
      );
    }
    return;
  }

  logRequestSuccess(requestId, `Stuck transition marked failed: ${transitionId}`);
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
          message: "World state changed during end-turn processing. Refresh and retry.",
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

function rpcErrorToEnqueueResult(
  error: SupabaseRpcError,
  requestId: string,
): EnqueueTurnJobResult {
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

    if (error.hint === "running_transition") {
      logRequestFailure(
        requestId,
        "end_turn_running_transition",
        "A turn is already running for this world",
      );
      return {
        error: createErrorResponse({
          code: "end_turn_running_transition",
          message: "A turn is already being advanced for this world.",
        }),
        ok: false,
        status: 409,
      };
    }
  }

  logRequestFailure(requestId, "end_turn_transition_unavailable", "Unknown RPC error");
  return createEnqueueUnavailableResult();
}

function createEnqueueUnavailableResult(): EnqueueTurnJobResult {
  return {
    error: createErrorResponse({
      code: "end_turn_transition_unavailable",
      message: "End turn could not be queued.",
    }),
    ok: false,
    status: 500,
  };
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
