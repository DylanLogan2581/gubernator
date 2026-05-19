import { getRequiredRuntimeEnv } from "./env.ts";
import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnBasicAuthContext,
  EndTurnBasicPersistedTransition,
  EndTurnBasicPersistRunningTransitionResult,
} from "./types.ts";
import type {
  BasicEndTurnTransitionInput,
  BasicEndTurnTransitionResult,
} from "../../../src/shared/endTurnTransitionTypes.ts";

type SupabasePersistedTransitionRow = {
  readonly from_turn_number: number;
  readonly id: string;
  readonly initiated_by_user_id: string;
  readonly started_at: string;
  readonly status: "completed" | "failed" | "running";
  readonly to_turn_number: number;
  readonly world_id: string;
};

type SupabaseRunningTransitionFetchError =
  | {
      readonly reason:
        | "fetch_failed"
        | "invalid_payload"
        | "running_transition"
        | "stale_world_turn"
        | "transition_failed";
    }
  | {
      readonly reason: "http_error";
      readonly safeDeny: boolean;
    }
  | {
      readonly reason: "missing_transition";
    };

type SupabaseRunningTransitionResult =
  | {
      readonly ok: true;
      readonly transition: EndTurnBasicPersistedTransition;
    }
  | {
      readonly error: SupabaseRunningTransitionFetchError;
      readonly ok: false;
    };

export async function persistSupabaseRunningTransition(
  input: BasicEndTurnTransitionInput,
  transition: BasicEndTurnTransitionResult,
  authContext: EndTurnBasicAuthContext,
): Promise<EndTurnBasicPersistRunningTransitionResult> {
  const authorizationHeader = authContext.authorizationHeader;

  if (authorizationHeader === undefined) {
    return createTransitionPersistenceUnavailableResult();
  }

  const supabaseUrl = getRequiredRuntimeEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return createTransitionPersistenceUnavailableResult();
  }

  if (
    transition.fromTurnNumber !== input.expectedCurrentTurnNumber ||
    transition.toTurnNumber !== transition.fromTurnNumber + 1
  ) {
    return createTransitionPersistenceUnavailableResult();
  }

  const advanceResult = await advanceSupabaseWorldTurn({
    authorizationHeader,
    expectedTurnNumber: input.expectedCurrentTurnNumber,
    logPayload: transition.logPayload,
    notificationPayload: transition.notificationPayload,
    supabaseAnonKey,
    supabaseUrl,
    worldId: input.worldId,
  });

  if (advanceResult.ok) {
    return {
      ok: true,
      transition: advanceResult.transition,
    };
  }

  return transitionPersistenceResultFromFetchError(advanceResult.error);
}

async function advanceSupabaseWorldTurn({
  authorizationHeader,
  expectedTurnNumber,
  logPayload,
  notificationPayload,
  supabaseAnonKey,
  supabaseUrl,
  worldId,
}: {
  readonly authorizationHeader: string;
  readonly expectedTurnNumber: number;
  readonly logPayload: BasicEndTurnTransitionResult["logPayload"];
  readonly notificationPayload: BasicEndTurnTransitionResult["notificationPayload"];
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<SupabaseRunningTransitionResult> {
  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/advance_world_turn_if_current`,
      {
        body: JSON.stringify({
          p_expected_turn_number: expectedTurnNumber,
          p_log_payload_jsonb: logPayload,
          p_notification_payload_jsonb: notificationPayload,
          p_world_id: worldId,
        }),
        headers: {
          apikey: supabaseAnonKey,
          authorization: authorizationHeader,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
  } catch {
    return {
      error: {
        reason: "fetch_failed",
      },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: {
        reason: "http_error",
        safeDeny: response.status >= 400 && response.status < 500,
      },
      ok: false,
    };
  }

  return advanceWorldTurnResultFromResponse(response);
}

async function runningTransitionResultFromResponse(
  response: Response,
): Promise<SupabaseRunningTransitionResult> {
  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return {
      error: {
        reason: "invalid_payload",
      },
      ok: false,
    };
  }

  const rows: readonly unknown[] = payload;
  const row = rows[0];

  if (row === undefined) {
    return {
      error: {
        reason: "missing_transition",
      },
      ok: false,
    };
  }

  if (!isSupabasePersistedTransitionRow(row)) {
    return {
      error: {
        reason: "invalid_payload",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    transition: toEndTurnBasicPersistedTransition(row),
  };
}

async function advanceWorldTurnResultFromResponse(
  response: Response,
): Promise<SupabaseRunningTransitionResult> {
  const result = await runningTransitionResultFromResponse(response);

  if (!result.ok && result.error.reason === "missing_transition") {
    return {
      error: {
        reason: "stale_world_turn",
      },
      ok: false,
    };
  }

  if (result.ok && result.transition.status === "failed") {
    return {
      error: {
        reason: "transition_failed",
      },
      ok: false,
    };
  }

  if (result.ok && result.transition.status === "running") {
    return {
      error: {
        reason: "running_transition",
      },
      ok: false,
    };
  }

  return result;
}

function isSupabasePersistedTransitionRow(
  value: unknown,
): value is SupabasePersistedTransitionRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.world_id === "string" &&
    value.world_id.length > 0 &&
    typeof value.from_turn_number === "number" &&
    Number.isInteger(value.from_turn_number) &&
    value.from_turn_number >= 0 &&
    typeof value.to_turn_number === "number" &&
    Number.isInteger(value.to_turn_number) &&
    value.to_turn_number === value.from_turn_number + 1 &&
    typeof value.initiated_by_user_id === "string" &&
    value.initiated_by_user_id.length > 0 &&
    typeof value.started_at === "string" &&
    value.started_at.length > 0 &&
    (value.status === "completed" ||
      value.status === "failed" ||
      value.status === "running")
  );
}

function toEndTurnBasicPersistedTransition(
  row: SupabasePersistedTransitionRow,
): EndTurnBasicPersistedTransition {
  return {
    fromTurnNumber: row.from_turn_number,
    id: row.id,
    initiatedByUserId: row.initiated_by_user_id,
    startedAt: row.started_at,
    status: row.status,
    toTurnNumber: row.to_turn_number,
    worldId: row.world_id,
  };
}

function transitionPersistenceResultFromFetchError(
  error: SupabaseRunningTransitionFetchError,
): EndTurnBasicPersistRunningTransitionResult {
  if (error.reason === "stale_world_turn") {
    return {
      error: createErrorResponse({
        code: "end_turn_stale_expected_turn",
        message: "Expected current turn no longer matches the world state.",
      }),
      ok: false,
      status: 409,
    };
  }

  if (error.reason === "http_error" && error.safeDeny) {
    return {
      error: createErrorResponse({
        code: "unauthorized",
        message: "End turn is unavailable for this world.",
      }),
      ok: false,
      status: 403,
    };
  }

  if (error.reason === "transition_failed") {
    return {
      error: createErrorResponse({
        code: "end_turn_transition_failed",
        message: "End turn persistence failed after the transition started.",
      }),
      ok: false,
      status: 500,
    };
  }

  if (error.reason === "running_transition") {
    return {
      error: createErrorResponse({
        code: "end_turn_running_transition",
        message: "Another end-turn transition is already running.",
      }),
      ok: false,
      status: 409,
    };
  }

  return createTransitionPersistenceUnavailableResult();
}

function createTransitionPersistenceUnavailableResult(): EndTurnBasicPersistRunningTransitionResult {
  return {
    error: createErrorResponse({
      code: "end_turn_transition_unavailable",
      message: "End turn transition could not be started.",
    }),
    ok: false,
    status: 500,
  };
}
