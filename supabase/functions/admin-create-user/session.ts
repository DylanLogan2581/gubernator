import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";
import { createErrorResponse } from "./http.ts";

import type {
  AdminCreateUserAuthContext,
  AdminCreateUserAuthContextResult,
} from "./types.ts";

export async function resolveAdminCreateUserAuthContext(
  request: Request,
): Promise<AdminCreateUserAuthContextResult> {
  const authorizationHeader = getAuthorizationHeader(request);

  if (authorizationHeader === null) {
    return createAuthErrorResult();
  }

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
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
    } satisfies AdminCreateUserAuthContext,
    ok: true,
  };
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

function isAuthUserPayload(value: unknown): value is { readonly id: string } {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return false;
  }
  const id = (value as Record<string, unknown>)["id"];
  return typeof id === "string" && id.length > 0;
}

function createAuthErrorResult(): AdminCreateUserAuthContextResult {
  return {
    error: createErrorResponse({
      code: "unauthenticated",
      message: "An authenticated Supabase session is required.",
    }),
    ok: false,
    status: 401,
  };
}
