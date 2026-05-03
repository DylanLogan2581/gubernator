import type { WorldCalendarConfig } from "@/features/calendar";
import {
  isBasicEndTurnTransitionPlanningError,
  planBasicEndTurnTransition,
  type BasicEndTurnReadinessRow,
  type BasicEndTurnTransitionInput,
  type BasicEndTurnTransitionResult,
} from "@/features/turns";

type EdgeRuntime = {
  readonly env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Promise<Response> | Response): void;
};

declare const Deno: EdgeRuntime | undefined;

export type EndTurnBasicRequestBody = {
  readonly expectedTurnNumber: number;
  readonly worldId: string;
};

export type EndTurnBasicErrorCode =
  | "auth_context_unavailable"
  | "end_turn_calendar_config_invalid"
  | "end_turn_stale_expected_turn"
  | "end_turn_state_unavailable"
  | "end_turn_transition_unavailable"
  | "end_turn_world_archived"
  | "end_turn_world_not_found"
  | "invalid_request"
  | "method_not_allowed"
  | "unauthorized"
  | "unauthenticated";

export type EndTurnBasicErrorResponse = {
  readonly error: {
    readonly code: EndTurnBasicErrorCode;
    readonly details?: readonly string[];
    readonly message: string;
  };
  readonly ok: false;
};

export type EndTurnBasicSuccessResponse = {
  readonly data: {
    readonly actorId: string;
    readonly transition: EndTurnBasicDryWriteTransitionResult;
    readonly worldId: string;
  };
  readonly ok: true;
};

export type EndTurnBasicResponse =
  | EndTurnBasicErrorResponse
  | EndTurnBasicSuccessResponse;

export type EndTurnBasicDryWriteTransitionResult = {
  readonly nextDate: BasicEndTurnTransitionResult["nextDate"];
  readonly nextTurnNumber: number;
  readonly previousDate: BasicEndTurnTransitionResult["previousDate"];
  readonly previousTurnNumber: number;
  readonly readinessSummary: BasicEndTurnTransitionResult["readinessSummary"];
};

export type EndTurnBasicAuthContext = {
  readonly authorizationHeader?: string;
  readonly userId: string;
};

export type EndTurnBasicRunningTransition = {
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly initiatedByUserId: string;
  readonly startedAt: string;
  readonly status: "running";
  readonly toTurnNumber: number;
  readonly worldId: string;
};

export type EndTurnBasicAuthContextResult =
  | {
      readonly context: EndTurnBasicAuthContext;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicAuthorizationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicTransitionInputResult =
  | {
      readonly input: BasicEndTurnTransitionInput;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicPersistRunningTransitionResult =
  | {
      readonly ok: true;
      readonly transition: EndTurnBasicRunningTransition;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicHandlerOptions = {
  readonly resolveTransitionInput?: (
    requestBody: EndTurnBasicRequestBody,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicTransitionInputResult>;
  readonly resolveAuthorization?: (
    requestBody: EndTurnBasicRequestBody,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicAuthorizationResult>;
  readonly resolveAuthContext?: (
    request: Request,
  ) => Promise<EndTurnBasicAuthContextResult>;
  readonly persistRunningTransition?: (
    input: BasicEndTurnTransitionInput,
    transition: BasicEndTurnTransitionResult,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicPersistRunningTransitionResult>;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const;

const expectedRequestFields = ["expectedTurnNumber", "worldId"] as const;
const expectedCalendarConfigFields = [
  "months",
  "startingDayOfMonth",
  "startingMonthIndex",
  "startingWeekdayOffset",
  "startingYear",
  "weekdays",
  "yearFormatTemplate",
] as const;
const expectedCalendarMonthFields = ["dayCount", "index", "name"] as const;
const expectedCalendarWeekdayFields = ["index", "name"] as const;

export async function handleEndTurnBasicRequest(
  request: Request,
  options: EndTurnBasicHandlerOptions = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return createJsonResponse(
      createErrorResponse({
        code: "method_not_allowed",
        message: "Use POST to request an end-turn transition.",
      }),
      405,
    );
  }

  const requestBodyResult = await parseEndTurnBasicRequestBody(request);

  if (!requestBodyResult.ok) {
    return createJsonResponse(requestBodyResult.error, 400);
  }

  const resolveAuthContext =
    options.resolveAuthContext ?? resolveSupabaseAuthContext;
  const authContextResult = await resolveAuthContext(request);

  if (!authContextResult.ok) {
    return createJsonResponse(
      authContextResult.error,
      authContextResult.status,
    );
  }

  const resolveAuthorization =
    options.resolveAuthorization ?? resolveSupabaseEndTurnAuthorization;
  const authorizationResult = await resolveAuthorization(
    requestBodyResult.body,
    authContextResult.context,
  );

  if (!authorizationResult.ok) {
    return createJsonResponse(
      authorizationResult.error,
      authorizationResult.status,
    );
  }

  const resolveTransitionInput =
    options.resolveTransitionInput ?? resolveSupabaseEndTurnTransitionInput;
  const transitionInputResult = await resolveTransitionInput(
    requestBodyResult.body,
    authContextResult.context,
  );

  if (!transitionInputResult.ok) {
    return createJsonResponse(
      transitionInputResult.error,
      transitionInputResult.status,
    );
  }

  const plannedTransitionResult = planDryWriteEndTurnTransition(
    transitionInputResult.input,
  );

  if (!plannedTransitionResult.ok) {
    return createJsonResponse(
      plannedTransitionResult.error,
      plannedTransitionResult.status,
    );
  }

  const persistRunningTransition =
    options.persistRunningTransition ?? persistSupabaseRunningTransition;
  const persistedTransitionResult = await persistRunningTransition(
    transitionInputResult.input,
    plannedTransitionResult.transition,
    authContextResult.context,
  );

  if (!persistedTransitionResult.ok) {
    return createJsonResponse(
      persistedTransitionResult.error,
      persistedTransitionResult.status,
    );
  }

  return createJsonResponse(
    {
      data: {
        actorId: authContextResult.context.userId,
        transition: mapDryWriteTransitionResult(
          plannedTransitionResult.transition,
        ),
        worldId: requestBodyResult.body.worldId,
      },
      ok: true,
    },
    200,
  );
}

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

export async function resolveSupabaseAuthContext(
  request: Request,
): Promise<EndTurnBasicAuthContextResult> {
  const authorizationHeader = getAuthorizationHeader(request);

  if (authorizationHeader === null) {
    return createAuthErrorResult();
  }

  const supabaseUrl = getRequiredRuntimeEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return {
      error: createErrorResponse({
        code: "auth_context_unavailable",
        message: "Supabase auth configuration is unavailable.",
      }),
      ok: false,
      status: 500,
    };
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: authorizationHeader,
    },
    method: "GET",
  });

  if (!authResponse.ok) {
    return createAuthErrorResult();
  }

  const authPayload: unknown = await authResponse.json();

  if (!isAuthUserPayload(authPayload)) {
    return createAuthErrorResult();
  }

  return {
    context: {
      authorizationHeader,
      userId: authPayload.id,
    },
    ok: true,
  };
}

export async function resolveSupabaseEndTurnAuthorization(
  requestBody: EndTurnBasicRequestBody,
  authContext: EndTurnBasicAuthContext,
): Promise<EndTurnBasicAuthorizationResult> {
  const authorizationHeader = authContext.authorizationHeader;

  if (authorizationHeader === undefined) {
    return createAuthContextUnavailableResult();
  }

  const supabaseUrl = getRequiredRuntimeEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return createAuthContextUnavailableResult();
  }

  const superAdminResult = await fetchSupabaseRpcBoolean({
    authorizationHeader,
    body: {},
    functionName: "is_super_admin",
    supabaseAnonKey,
    supabaseUrl,
  });

  if (!superAdminResult.ok) {
    return resultFromSupabaseAuthorizationFetchError(superAdminResult.error);
  }

  if (superAdminResult.value) {
    const worldExistsResult = await fetchSupabaseWorldExists({
      authorizationHeader,
      supabaseAnonKey,
      supabaseUrl,
      worldId: requestBody.worldId,
    });

    if (!worldExistsResult.ok) {
      return resultFromSupabaseAuthorizationFetchError(worldExistsResult.error);
    }

    if (worldExistsResult.value) {
      return { ok: true };
    }

    return createAuthorizationErrorResult();
  }

  const worldAdminResult = await fetchSupabaseRpcBoolean({
    authorizationHeader,
    body: {
      p_world_id: requestBody.worldId,
    },
    functionName: "is_world_admin",
    supabaseAnonKey,
    supabaseUrl,
  });

  if (!worldAdminResult.ok) {
    return resultFromSupabaseAuthorizationFetchError(worldAdminResult.error);
  }

  if (!worldAdminResult.value) {
    return createAuthorizationErrorResult();
  }

  return { ok: true };
}

async function parseEndTurnBasicRequestBody(request: Request): Promise<
  | {
      readonly body: EndTurnBasicRequestBody;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
    }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: ["body"],
        message: "Request body must be valid JSON.",
      }),
      ok: false,
    };
  }

  const bodyShapeResult = parseEndTurnBasicRequestBodyShape(body);

  if (!bodyShapeResult.ok) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: bodyShapeResult.validationErrors,
        message: "Request body must include worldId and expectedTurnNumber.",
      }),
      ok: false,
    };
  }

  return {
    body: {
      expectedTurnNumber: bodyShapeResult.body.expectedTurnNumber,
      worldId: bodyShapeResult.body.worldId.trim(),
    },
    ok: true,
  };
}

function parseEndTurnBasicRequestBodyShape(body: unknown):
  | {
      readonly body: EndTurnBasicRequestBody;
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly validationErrors: readonly string[];
    } {
  const validationErrors = validateEndTurnBasicRequestBody(body);

  if (validationErrors.length > 0 || !isEndTurnBasicRequestBody(body)) {
    return {
      ok: false,
      validationErrors,
    };
  }

  return {
    body,
    ok: true,
  };
}

function validateEndTurnBasicRequestBody(body: unknown): readonly string[] {
  if (!isRecord(body)) {
    return ["body"];
  }

  const validationErrors: string[] = [];

  if (!hasOnlyExpectedFields(body, expectedRequestFields)) {
    validationErrors.push("body");
  }

  if (typeof body.worldId !== "string" || body.worldId.trim().length === 0) {
    validationErrors.push("worldId");
  }

  if (
    typeof body.expectedTurnNumber !== "number" ||
    !Number.isSafeInteger(body.expectedTurnNumber) ||
    body.expectedTurnNumber < 0
  ) {
    validationErrors.push("expectedTurnNumber");
  }

  return validationErrors;
}

function isEndTurnBasicRequestBody(
  body: unknown,
): body is EndTurnBasicRequestBody {
  return (
    isRecord(body) &&
    hasOnlyExpectedFields(body, expectedRequestFields) &&
    typeof body.worldId === "string" &&
    body.worldId.trim().length > 0 &&
    typeof body.expectedTurnNumber === "number" &&
    Number.isSafeInteger(body.expectedTurnNumber) &&
    body.expectedTurnNumber >= 0
  );
}

function hasOnlyExpectedFields(
  body: Record<string, unknown>,
  expectedFields: readonly string[],
): boolean {
  return Object.keys(body).every((fieldName) =>
    expectedFields.some((expectedField) => expectedField === fieldName),
  );
}

function createAuthErrorResult(): EndTurnBasicAuthContextResult {
  return {
    error: createErrorResponse({
      code: "unauthenticated",
      message: "An authenticated Supabase session is required.",
    }),
    ok: false,
    status: 401,
  };
}

function createAuthorizationErrorResult(): EndTurnBasicAuthorizationResult {
  return {
    error: createErrorResponse({
      code: "unauthorized",
      message: "End turn is unavailable for this world.",
    }),
    ok: false,
    status: 403,
  };
}

function createAuthContextUnavailableResult(): EndTurnBasicAuthorizationResult {
  return {
    error: createErrorResponse({
      code: "auth_context_unavailable",
      message: "Supabase auth configuration is unavailable.",
    }),
    ok: false,
    status: 500,
  };
}

function createTransitionStateUnavailableResult(): EndTurnBasicTransitionInputResult {
  return {
    error: createErrorResponse({
      code: "end_turn_state_unavailable",
      message: "End turn state is unavailable.",
    }),
    ok: false,
    status: 500,
  };
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

function planDryWriteEndTurnTransition(input: BasicEndTurnTransitionInput):
  | {
      readonly ok: true;
      readonly transition: BasicEndTurnTransitionResult;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    } {
  try {
    return {
      ok: true,
      transition: planBasicEndTurnTransition(input),
    };
  } catch (error) {
    if (isBasicEndTurnTransitionPlanningError(error)) {
      return {
        error: createErrorResponse({
          code: error.code,
          message: error.message,
        }),
        ok: false,
        status: 409,
      };
    }

    return createTransitionStateUnavailableResult();
  }
}

function mapDryWriteTransitionResult(
  transition: BasicEndTurnTransitionResult,
): EndTurnBasicDryWriteTransitionResult {
  return {
    nextDate: transition.nextDate,
    nextTurnNumber: transition.toTurnNumber,
    previousDate: transition.previousDate,
    previousTurnNumber: transition.fromTurnNumber,
    readinessSummary: transition.readinessSummary,
  };
}

function createErrorResponse({
  code,
  details,
  message,
}: {
  readonly code: EndTurnBasicErrorCode;
  readonly details?: readonly string[];
  readonly message: string;
}): EndTurnBasicErrorResponse {
  if (details === undefined) {
    return {
      error: {
        code,
        message,
      },
      ok: false,
    };
  }

  return {
    error: {
      code,
      details,
      message,
    },
    ok: false,
  };
}

function createJsonResponse(
  body: EndTurnBasicResponse,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

function getAuthorizationHeader(request: Request): string | null {
  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader === null) {
    return null;
  }

  const trimmedHeader = authorizationHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const bearerToken = trimmedHeader.slice("bearer ".length).trim();

  if (bearerToken.length === 0) {
    return null;
  }

  return `Bearer ${bearerToken}`;
}

function getRequiredRuntimeEnv(name: string): string | undefined {
  const edgeRuntime = getEdgeRuntime();

  if (edgeRuntime === undefined) {
    return undefined;
  }

  const value = edgeRuntime.env.get(name);

  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return value.replace(/\/$/, "");
}

function getEdgeRuntime(): EdgeRuntime | undefined {
  if (typeof Deno === "undefined") {
    return undefined;
  }

  return Deno;
}

function isAuthUserPayload(value: unknown): value is { readonly id: string } {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0;
}

type SupabaseAuthorizationFetchError = {
  readonly safeDeny: boolean;
};

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

type SupabaseBooleanFetchResult =
  | {
      readonly ok: true;
      readonly value: boolean;
    }
  | {
      readonly error: SupabaseAuthorizationFetchError;
      readonly ok: false;
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

type SupabaseRunningTransitionRow = {
  readonly from_turn_number: number;
  readonly id: string;
  readonly initiated_by_user_id: string;
  readonly started_at: string;
  readonly status: "running";
  readonly to_turn_number: number;
  readonly world_id: string;
};

type SupabaseRunningTransitionFetchError =
  | {
      readonly reason: "fetch_failed" | "invalid_payload" | "stale_world_turn";
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
      readonly transition: EndTurnBasicRunningTransition;
    }
  | {
      readonly error: SupabaseRunningTransitionFetchError;
      readonly ok: false;
    };

async function fetchSupabaseRpcBoolean({
  authorizationHeader,
  body,
  functionName,
  supabaseAnonKey,
  supabaseUrl,
}: {
  readonly authorizationHeader: string;
  readonly body: Record<string, unknown>;
  readonly functionName: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
}): Promise<SupabaseBooleanFetchResult> {
  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      body: JSON.stringify(body),
      headers: {
        apikey: supabaseAnonKey,
        authorization: authorizationHeader,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return {
      error: {
        safeDeny: false,
      },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: {
        safeDeny: response.status >= 400 && response.status < 500,
      },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (typeof payload !== "boolean") {
    return {
      error: {
        safeDeny: false,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: payload,
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

async function fetchSupabaseWorldExists({
  authorizationHeader,
  supabaseAnonKey,
  supabaseUrl,
  worldId,
}: {
  readonly authorizationHeader: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<SupabaseBooleanFetchResult> {
  const searchParameters = new URLSearchParams({
    id: `eq.${worldId}`,
    limit: "1",
    select: "id",
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
        safeDeny: false,
      },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: {
        safeDeny: response.status >= 400 && response.status < 500,
      },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return {
      error: {
        safeDeny: false,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: payload.length > 0,
  };
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

  if (!isSupabaseRunningTransitionRow(row)) {
    return {
      error: {
        reason: "invalid_payload",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    transition: toEndTurnBasicRunningTransition(row),
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

  return result;
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

  return createTransitionPersistenceUnavailableResult();
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

function resultFromSupabaseAuthorizationFetchError(
  error: SupabaseAuthorizationFetchError,
): EndTurnBasicAuthorizationResult {
  if (error.safeDeny) {
    return createAuthorizationErrorResult();
  }

  return createAuthContextUnavailableResult();
}

function parseWorldCalendarConfig(value: unknown): WorldCalendarConfig | null {
  if (
    !isRecord(value) ||
    !hasOnlyExpectedFields(value, expectedCalendarConfigFields)
  ) {
    return null;
  }

  const weekdays = parseCalendarWeekdays(value.weekdays);
  const months = parseCalendarMonths(value.months);

  if (weekdays === null || months === null) {
    return null;
  }

  const startingDayOfMonth = value.startingDayOfMonth;
  const startingMonthIndex = value.startingMonthIndex;
  const startingWeekdayOffset = value.startingWeekdayOffset;
  const startingYear = value.startingYear;
  const yearFormatTemplate = value.yearFormatTemplate;

  if (
    !isNonnegativeInteger(startingMonthIndex) ||
    startingMonthIndex >= months.length ||
    !isPositiveInteger(startingDayOfMonth) ||
    !isInteger(startingYear) ||
    !isNonnegativeInteger(startingWeekdayOffset) ||
    startingWeekdayOffset >= weekdays.length ||
    typeof yearFormatTemplate !== "string" ||
    yearFormatTemplate.trim().length === 0 ||
    !yearFormatTemplate.includes("{n}")
  ) {
    return null;
  }

  const startingMonth = months[startingMonthIndex];

  if (
    startingMonth === undefined ||
    startingDayOfMonth > startingMonth.dayCount
  ) {
    return null;
  }

  return {
    months,
    startingDayOfMonth,
    startingMonthIndex,
    startingWeekdayOffset,
    startingYear,
    weekdays,
    yearFormatTemplate,
  };
}

function parseCalendarWeekdays(
  value: unknown,
): WorldCalendarConfig["weekdays"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const weekdays: WorldCalendarConfig["weekdays"] = [];

  for (const [weekdayIndex, weekday] of value.entries()) {
    if (
      !isRecord(weekday) ||
      !hasOnlyExpectedFields(weekday, expectedCalendarWeekdayFields) ||
      weekday.index !== weekdayIndex ||
      typeof weekday.name !== "string" ||
      weekday.name.trim().length === 0
    ) {
      return null;
    }

    weekdays.push({
      index: weekday.index,
      name: weekday.name,
    });
  }

  return weekdays;
}

function parseCalendarMonths(
  value: unknown,
): WorldCalendarConfig["months"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const months: WorldCalendarConfig["months"] = [];

  for (const [monthIndex, month] of value.entries()) {
    if (
      !isRecord(month) ||
      !hasOnlyExpectedFields(month, expectedCalendarMonthFields) ||
      month.index !== monthIndex ||
      typeof month.name !== "string" ||
      month.name.trim().length === 0 ||
      !isPositiveInteger(month.dayCount)
    ) {
      return null;
    }

    months.push({
      dayCount: month.dayCount,
      index: month.index,
      name: month.name,
    });
  }

  return months;
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

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
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

function isSupabaseRunningTransitionRow(
  value: unknown,
): value is SupabaseRunningTransitionRow {
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
    value.status === "running"
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

function toEndTurnBasicRunningTransition(
  row: SupabaseRunningTransitionRow,
): EndTurnBasicRunningTransition {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleEndTurnBasicRequest);
}
