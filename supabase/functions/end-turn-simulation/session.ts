import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";
import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationAuthContextResult,
} from "./types.ts";

export async function resolveSupabaseSimulationAuthContext(
  request: Request,
): Promise<EndTurnSimulationAuthContextResult> {
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

  let authResponse: Response;
  try {
    authResponse = await supabaseFetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: authorizationHeader,
      },
      method: "GET",
    });
  } catch {
    return createAuthErrorResult();
  }

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
    } satisfies EndTurnSimulationAuthContext,
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

function createAuthErrorResult(): EndTurnSimulationAuthContextResult {
  return {
    error: createErrorResponse({
      code: "unauthenticated",
      message: "An authenticated Supabase session is required.",
    }),
    ok: false,
    status: 401,
  };
}
