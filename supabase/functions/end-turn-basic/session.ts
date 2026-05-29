import { getRequiredRuntimeEnv } from "./env.ts";
import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnBasicAuthContext,
  EndTurnBasicAuthContextResult,
} from "./types.ts";

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
    } satisfies EndTurnBasicAuthContext,
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
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0;
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
