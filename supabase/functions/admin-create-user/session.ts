import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";
import { getAuthorizationHeader, resolveAuthContext } from "../_shared/http/session.ts";

import { createErrorResponse } from "./http.ts";

import type {
  AdminCreateUserAuthContext,
  AdminCreateUserAuthContextResult,
  AdminCreateUserErrorResponse,
} from "./types.ts";

export async function resolveAdminCreateUserAuthContext(
  request: Request,
): Promise<AdminCreateUserAuthContextResult> {
  // Check auth header first, before any config access.
  // This allows rejection of missing/invalid auth to be independent of env availability.
  const authHeader = getAuthorizationHeader(request);
  if (authHeader === null) {
    return {
      error: createErrorResponse({
        code: "unauthenticated",
        message: "An authenticated Supabase session is required.",
      }),
      ok: false,
      status: 401,
    };
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

  const result = await resolveAuthContext<
    AdminCreateUserAuthContext,
    AdminCreateUserErrorResponse
  >(request, {
    fetchFn: fetch,
    supabaseUrl,
    supabaseAnonKey,
    onAuthError: () => ({
      ok: false,
      error: createErrorResponse({
        code: "unauthenticated",
        message: "An authenticated Supabase session is required.",
      }),
      status: 401,
    }),
    onSuccess: (context) => ({
      ok: true,
      context: {
        ...context,
        authorizationHeader: authHeader,
      } satisfies AdminCreateUserAuthContext,
    }),
  });

  if (!result.ok) {
    return result;
  }

  return result;
}
