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
    readonly expectedTurnNumber: number;
    readonly worldId: string;
  };
  readonly ok: true;
};

export type EndTurnBasicResponse =
  | EndTurnBasicErrorResponse
  | EndTurnBasicSuccessResponse;

export type EndTurnBasicAuthContext = {
  readonly authorizationHeader?: string;
  readonly userId: string;
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

export type EndTurnBasicHandlerOptions = {
  readonly resolveAuthorization?: (
    requestBody: EndTurnBasicRequestBody,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicAuthorizationResult>;
  readonly resolveAuthContext?: (
    request: Request,
  ) => Promise<EndTurnBasicAuthContextResult>;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const;

const expectedRequestFields = ["expectedTurnNumber", "worldId"] as const;

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

  return createJsonResponse(
    {
      data: {
        actorId: authContextResult.context.userId,
        expectedTurnNumber: requestBodyResult.body.expectedTurnNumber,
        worldId: requestBodyResult.body.worldId,
      },
      ok: true,
    },
    200,
  );
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

  if (!hasOnlyExpectedFields(body)) {
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
    hasOnlyExpectedFields(body) &&
    typeof body.worldId === "string" &&
    body.worldId.trim().length > 0 &&
    typeof body.expectedTurnNumber === "number" &&
    Number.isSafeInteger(body.expectedTurnNumber) &&
    body.expectedTurnNumber >= 0
  );
}

function hasOnlyExpectedFields(body: Record<string, unknown>): boolean {
  return Object.keys(body).every((fieldName) =>
    expectedRequestFields.some((expectedField) => expectedField === fieldName),
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

type SupabaseBooleanFetchResult =
  | {
      readonly ok: true;
      readonly value: boolean;
    }
  | {
      readonly error: SupabaseAuthorizationFetchError;
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

function resultFromSupabaseAuthorizationFetchError(
  error: SupabaseAuthorizationFetchError,
): EndTurnBasicAuthorizationResult {
  if (error.safeDeny) {
    return createAuthorizationErrorResult();
  }

  return createAuthContextUnavailableResult();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleEndTurnBasicRequest);
}
