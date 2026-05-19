import { getRequiredRuntimeEnv } from "./env.ts";
import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";
import { parseWorldCalendarConfig } from "./validate.ts";

import type {
  EndTurnBasicAuthContext,
  EndTurnBasicErrorResponse,
  EndTurnBasicRequestBody,
  EndTurnBasicTransitionInputResult,
} from "./types.ts";
import type { BasicEndTurnReadinessRow } from "../../../src/shared/endTurnTransitionTypes.ts";

type SupabaseStateFetchError =
  | {
      readonly reason: "fetch_failed" | "invalid_payload";
    }
  | {
      readonly reason: "http_error";
      readonly safeDeny: boolean;
    }
  | {
      readonly reason: "missing_world";
    };

type SupabaseEndTurnWorldStateRow = {
  readonly calendar_config_json: unknown;
  readonly current_turn_number: number;
  readonly id: string;
  readonly status: "active" | "archived";
};

type SupabaseEndTurnWorldStateResult =
  | {
      readonly ok: true;
      readonly row: SupabaseEndTurnWorldStateRow;
    }
  | {
      readonly error: SupabaseStateFetchError;
      readonly ok: false;
    };

type SupabaseEndTurnReadinessRowsResult =
  | {
      readonly ok: true;
      readonly rows: readonly BasicEndTurnReadinessRow[];
    }
  | {
      readonly error: SupabaseStateFetchError;
      readonly ok: false;
    };

export async function resolveSupabaseEndTurnTransitionInput(
  requestBody: EndTurnBasicRequestBody,
  authContext: EndTurnBasicAuthContext,
): Promise<EndTurnBasicTransitionInputResult> {
  const authorizationHeader = authContext.authorizationHeader;

  if (authorizationHeader === undefined) {
    return createTransitionStateUnavailableResult();
  }

  const supabaseUrl = getRequiredRuntimeEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return createTransitionStateUnavailableResult();
  }

  const worldResult = await fetchSupabaseEndTurnWorldState({
    authorizationHeader,
    supabaseAnonKey,
    supabaseUrl,
    worldId: requestBody.worldId,
  });

  if (!worldResult.ok) {
    return transitionInputResultFromStateFetchError(worldResult.error);
  }

  const calendarConfig = parseWorldCalendarConfig(
    worldResult.row.calendar_config_json,
  );

  if (calendarConfig === null) {
    return {
      error: createErrorResponse({
        code: "end_turn_calendar_config_invalid",
        message: "Calendar configuration is invalid.",
      }),
      ok: false,
      status: 500,
    };
  }

  const readinessRowsResult = await fetchSupabaseEndTurnReadinessRows({
    authorizationHeader,
    supabaseAnonKey,
    supabaseUrl,
    worldId: requestBody.worldId,
  });

  if (!readinessRowsResult.ok) {
    return transitionInputResultFromStateFetchError(readinessRowsResult.error);
  }

  return {
    input: {
      actorId: authContext.userId,
      calendarConfig,
      currentTurnNumber: worldResult.row.current_turn_number,
      expectedCurrentTurnNumber: requestBody.expectedTurnNumber,
      isWorldArchived: worldResult.row.status === "archived",
      readinessRows: readinessRowsResult.rows,
      worldId: worldResult.row.id,
    },
    ok: true,
  };
}

async function fetchSupabaseEndTurnWorldState({
  authorizationHeader,
  supabaseAnonKey,
  supabaseUrl,
  worldId,
}: {
  readonly authorizationHeader: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<SupabaseEndTurnWorldStateResult> {
  const searchParameters = new URLSearchParams({
    id: `eq.${worldId}`,
    limit: "1",
    select: "id,current_turn_number,status,calendar_config_json",
  });
  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/worlds?${searchParameters}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          authorization: authorizationHeader,
        },
        method: "GET",
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
        reason: "missing_world",
      },
      ok: false,
    };
  }

  if (!isSupabaseEndTurnWorldStateRow(row)) {
    return {
      error: {
        reason: "invalid_payload",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    row,
  };
}

async function fetchSupabaseEndTurnReadinessRows({
  authorizationHeader,
  supabaseAnonKey,
  supabaseUrl,
  worldId,
}: {
  readonly authorizationHeader: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<SupabaseEndTurnReadinessRowsResult> {
  const searchParameters = new URLSearchParams({
    "nations.world_id": `eq.${worldId}`,
    order: "id.asc",
    select: "id,auto_ready_enabled,is_ready_current_turn,nations!inner()",
  });
  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/settlements?${searchParameters}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          authorization: authorizationHeader,
        },
        method: "GET",
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

  const payload: unknown = await response.json();

  if (!Array.isArray(payload) || !payload.every(isSupabaseReadinessRow)) {
    return {
      error: {
        reason: "invalid_payload",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    rows: payload.map(toBasicEndTurnReadinessRow),
  };
}

function isSupabaseEndTurnWorldStateRow(
  value: unknown,
): value is SupabaseEndTurnWorldStateRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.current_turn_number === "number" &&
    Number.isInteger(value.current_turn_number) &&
    value.current_turn_number >= 0 &&
    (value.status === "active" || value.status === "archived")
  );
}

function isSupabaseReadinessRow(value: unknown): value is {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
} {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.auto_ready_enabled === "boolean" &&
    typeof value.is_ready_current_turn === "boolean"
  );
}

function toBasicEndTurnReadinessRow(row: {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
}): BasicEndTurnReadinessRow {
  return {
    autoReadyEnabled: row.auto_ready_enabled,
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
  };
}

function transitionInputResultFromStateFetchError(
  error: SupabaseStateFetchError,
): EndTurnBasicTransitionInputResult {
  if (error.reason === "missing_world") {
    return {
      error: createErrorResponse({
        code: "end_turn_world_not_found",
        message: "World is unavailable.",
      }),
      ok: false,
      status: 404,
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

  return createTransitionStateUnavailableResult();
}

export function createTransitionStateUnavailableResult(): {
  readonly error: EndTurnBasicErrorResponse;
  readonly ok: false;
  readonly status: number;
} {
  return {
    error: createErrorResponse({
      code: "end_turn_state_unavailable",
      message: "End turn state is unavailable.",
    }),
    ok: false,
    status: 500,
  };
}
