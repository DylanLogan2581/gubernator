import {
  logAdminCreateUserSuccess,
  logAuthorizationDenial,
} from "../_shared/auditLog.ts";

import {
  getEdgeRuntime,
  getRequiredRuntimeEnv,
  getRequiredRuntimeUrl,
} from "./env.ts";
import {
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
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
  const origin = request.headers.get("origin");

  if (origin !== null && !allowedOrigins.includes(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }

  const allowedOrigin = origin;

  const respond = (body: AdminCreateUserResponse, status: number): Response =>
    createJsonResponse(body, status, allowedOrigin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-headers":
          "authorization, x-client-info, apikey, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-origin": allowedOrigin ?? "*",
        "access-control-max-age": "86400",
      },
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

  const createResult = await createAuthUser(validateResult.body);
  if (!createResult.ok) {
    return respond(createResult.error, createResult.status);
  }

  logAdminCreateUserSuccess(
    authContextResult.context.userId,
    createResult.data.userId,
    createResult.data.email,
  );

  return respond({ data: createResult.data, ok: true }, 200);
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
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_super_admin`, {
      body: JSON.stringify({}),
      headers: {
        apikey: supabaseAnonKey,
        authorization: authContext.authorizationHeader,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return { ok: false };
  }

  if (!response.ok) {
    const safeDeny = response.status >= 400 && response.status < 500;
    return safeDeny ? { ok: true, value: false } : { ok: false };
  }

  const payload: unknown = await response.json();
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
    response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      body: JSON.stringify(adminPayload),
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return {
      error: createErrorResponse({
        code: "auth_admin_error",
        message: "Failed to reach authentication service.",
      }),
      ok: false,
      status: 502,
    };
  }

  const responseBody: unknown = await response.json();

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

    return {
      error: createErrorResponse({
        code: "auth_admin_error",
        message: message ?? "User creation failed.",
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
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" && typeof record["email"] === "string"
  );
}

function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  if (typeof record["msg"] === "string") return record["msg"];
  if (typeof record["message"] === "string") return record["message"];
  return undefined;
}

function isEmailConflict(message: string | undefined): boolean {
  if (message === undefined) return false;
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("exists");
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleAdminCreateUserRequest);
}
