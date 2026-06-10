import {
  logAdminCreateUserSuccess,
  logAuthorizationDenial,
} from "../_shared/auditLog.ts";
import {
  getEdgeRuntime,
  getRequiredRuntimeEnv,
  getRequiredRuntimeUrl,
} from "../_shared/http/env.ts";
import { isRecord } from "../_shared/http/guards.ts";
import { classifyHttpError, supabaseFetch } from "../_shared/supabaseFetch.ts";

import {
  buildCorsHeaders,
  createErrorResponse,
  createJsonResponse,
  getAllowedOrigins,
} from "./http.ts";
import { resolveAdminCreateUserAuthContext } from "./session.ts";
import { parseAdminCreateUserRequestBody } from "./validate.ts";

import type {
  AdminCreateUserAuthContext,
  AdminCreateUserHandlerOptions,
  AdminCreateUserRequestBody,
  AdminCreateUserResponse,
  AdminCreateUserSuccessData,
} from "./types.ts";

export type {
  AdminCreateUserAuthContext,
  AdminCreateUserErrorCode,
  AdminCreateUserErrorResponse,
  AdminCreateUserHandlerOptions,
  AdminCreateUserRequestBody,
  AdminCreateUserResponse,
  AdminCreateUserSuccessData,
  AdminCreateUserSuccessResponse,
} from "./types.ts";

type CheckSuperAdminResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false };

type CreateAuthUserResult =
  | { readonly data: AdminCreateUserSuccessData; readonly ok: true }
  | {
      readonly error: ReturnType<typeof createErrorResponse>;
      readonly ok: false;
      readonly status: number;
    };

export async function handleAdminCreateUserRequest(
  request: Request,
  options: AdminCreateUserHandlerOptions = {},
): Promise<Response> {
  try {
    const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
    const origin = request.headers.get("origin");

    // CORS allowlist is enforced for browser requests (those with an Origin header).
    // Requests without the Origin header (non-browser clients, scripts, servers)
    // bypass this check and proceed to the JWT + super-admin/world-admin checks,
    // which are the actual access boundary.
    if (origin !== null && !allowedOrigins.includes(origin)) {
      return createJsonResponse(
        createErrorResponse({
          code: "origin_not_allowed",
          message: "Origin not allowed.",
        }),
        403,
        null,
      );
    }

    const allowedOrigin = origin;

    const respond = (body: AdminCreateUserResponse, status: number): Response =>
      createJsonResponse(body, status, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: buildCorsHeaders(allowedOrigin),
        status: 204,
      });
    }

    if (request.method !== "POST") {
      return respond(
        createErrorResponse({
          code: "method_not_allowed",
          message: "Use POST to create a user.",
        }),
        405,
      );
    }

    const validateResult = await parseAdminCreateUserRequestBody(request);
    if (!validateResult.ok) {
      return respond(validateResult.error, 400);
    }

    const authContextResult = await resolveAdminCreateUserAuthContext(request);
    if (!authContextResult.ok) {
      return respond(authContextResult.error, authContextResult.status);
    }

    const superAdminResult = await checkIsSuperAdmin(authContextResult.context);

    if (!superAdminResult.ok || !superAdminResult.value) {
      logAuthorizationDenial(
        authContextResult.context.userId,
        validateResult.body.email,
        "superadmin_required",
      );
      return respond(
        createErrorResponse({
          code: "superadmin_required",
          message: "Superadmin privileges are required to create users.",
        }),
        403,
      );
    }

    // Idempotency key support: check if request with same key was already processed
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey !== null) {
      const cachedResult = await getIdempotencyKeyResult(idempotencyKey);
      if (cachedResult !== null) {
        return respond({ data: cachedResult, ok: true }, 200);
      }
    }

    const createResult = await createAuthUser(validateResult.body);
    if (!createResult.ok) {
      return respond(createResult.error, createResult.status);
    }

    // Store idempotency key for future identical requests
    if (idempotencyKey !== null) {
      await storeIdempotencyKeyResult(
        idempotencyKey,
        authContextResult.context.userId,
        createResult.data,
      );
    }

    logAdminCreateUserSuccess(
      authContextResult.context.userId,
      createResult.data.userId,
      createResult.data.email,
    );

    return respond({ data: createResult.data, ok: true }, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "unexpected_error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    const allowedOrigin = request.headers.get("origin");
    const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
    const safeAllowedOrigin =
      allowedOrigin !== null && allowedOrigins.includes(allowedOrigin)
        ? allowedOrigin
        : null;
    return createJsonResponse(
      createErrorResponse({
        code: "auth_admin_error",
        message: "An unexpected error occurred.",
      }),
      500,
      safeAllowedOrigin,
    );
  }
}

async function checkIsSuperAdmin(
  authContext: AdminCreateUserAuthContext,
): Promise<CheckSuperAdminResult> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return { ok: false };
  }

  let response: Response;
  try {
    response = await supabaseFetch(
      `${supabaseUrl}/rest/v1/rpc/is_super_admin`,
      {
        body: JSON.stringify({}),
        headers: {
          apikey: supabaseAnonKey,
          authorization: authContext.authorizationHeader,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "fetch_error",
        endpoint: "is_super_admin",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    return { ok: false };
  }

  if (!response.ok) {
    const { safeDeny } = classifyHttpError(response.status);
    return safeDeny ? { ok: true, value: false } : { ok: false };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "response_parse_error",
        endpoint: "is_super_admin",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    return { ok: false };
  }

  if (typeof payload !== "boolean") {
    return { ok: false };
  }

  return { ok: true, value: payload };
}

async function createAuthUser(
  body: AdminCreateUserRequestBody,
): Promise<CreateAuthUserResult> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    return {
      error: createErrorResponse({
        code: "auth_context_unavailable",
        message: "Service role configuration is unavailable.",
      }),
      ok: false,
      status: 500,
    };
  }

  const isMagicLink = body.sendMagicLink === true;
  const adminPayload: Record<string, unknown> = {
    email: body.email,
    email_confirm: !isMagicLink,
    user_metadata: { username: body.username },
  };

  if (!isMagicLink && body.password !== undefined) {
    adminPayload["password"] = body.password;
  }

  let response: Response;
  try {
    response = await supabaseFetch(`${supabaseUrl}/auth/v1/admin/users`, {
      body: JSON.stringify(adminPayload),
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "fetch_error",
        endpoint: "auth_admin_users",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    return {
      error: createErrorResponse({
        code: "auth_admin_error",
        message: "Failed to reach authentication service.",
      }),
      ok: false,
      status: 502,
    };
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "response_parse_error",
        endpoint: "auth_admin_users",
        status: response.status,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    return {
      error: createErrorResponse({
        code: "auth_admin_error",
        message: "Invalid response from authentication service.",
      }),
      ok: false,
      status: 502,
    };
  }

  if (!response.ok) {
    const message = extractErrorMessage(responseBody);

    if (response.status === 422 || isEmailConflict(message)) {
      return {
        error: createErrorResponse({
          code: "email_conflict",
          message: "A user with this email address already exists.",
        }),
        ok: false,
        status: 409,
      };
    }

    // Log raw upstream error server-side for debugging, but never expose to client
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "auth_admin_error",
        endpoint: "auth_admin_users",
        upstreamError: message,
        status: response.status,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      error: createErrorResponse({
        code: "auth_admin_error",
        message: "User creation failed.",
      }),
      ok: false,
      status: 500,
    };
  }

  if (!isAuthAdminUserPayload(responseBody)) {
    return {
      error: createErrorResponse({
        code: "auth_admin_error",
        message: "Unexpected response from authentication service.",
      }),
      ok: false,
      status: 500,
    };
  }

  return {
    data: {
      email: responseBody.email,
      userId: responseBody.id,
      username: body.username,
    },
    ok: true,
  };
}

function isAuthAdminUserPayload(
  value: unknown,
): value is { readonly id: string; readonly email: string } {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value["id"] === "string" && typeof value["email"] === "string";
}

function extractErrorMessage(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  if (typeof body["msg"] === "string") return body["msg"];
  if (typeof body["message"] === "string") return body["message"];
  return undefined;
}

function isEmailConflict(message: string | undefined): boolean {
  if (message === undefined) return false;
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("exists");
}

async function getIdempotencyKeyResult(
  idempotencyKey: string,
): Promise<AdminCreateUserSuccessData | null> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    // Silently skip idempotency check if config unavailable
    return null;
  }

  try {
    const response = await supabaseFetch(
      `${supabaseUrl}/rest/v1/admin_create_user_idempotency_keys?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&expires_at=gt.now()`,
      {
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        method: "GET",
      },
    );

    if (!response.ok) {
      return null;
    }

     
    const body: unknown = await response.json();
    if (!Array.isArray(body) || body.length === 0) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const record = body[0];
    if (
      !isRecord(record) ||
      typeof record["created_user_id"] !== "string" ||
      typeof record["created_user_email"] !== "string" ||
      typeof record["created_user_username"] !== "string"
    ) {
      return null;
    }

    return {
      userId: record["created_user_id"],
      email: record["created_user_email"],
      username: record["created_user_username"],
    };
  } catch {
    // Idempotency check failure should not block the request
    // Fall through to normal flow
    return null;
  }
}

async function storeIdempotencyKeyResult(
  idempotencyKey: string,
  callerUserId: string,
  data: AdminCreateUserSuccessData,
): Promise<void> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    // Silently skip storing idempotency key if config unavailable
    return;
  }

  try {
    await supabaseFetch(
      `${supabaseUrl}/rest/v1/admin_create_user_idempotency_keys`,
      {
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          caller_user_id: callerUserId,
          created_user_id: data.userId,
          created_user_email: data.email,
          created_user_username: data.username,
        }),
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
  } catch (error) {
    // Idempotency storage failure should not block response
    // Request was already successful, so we can safely ignore storage errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "idempotency_key_store_error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleAdminCreateUserRequest);
}
