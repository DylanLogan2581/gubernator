import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";
import { getAuthorizationHeader, resolveAuthContext } from "../_shared/http/session.ts";

import { createErrorResponse } from "./http.ts";

import type {
  SendEmailAuthContext,
  SendEmailAuthContextResult,
  SendEmailErrorResponse,
} from "./types.ts";

export async function resolveSendEmailAuthContext(
  request: Request,
): Promise<SendEmailAuthContextResult> {
  // Check auth header first, before any config access, so rejection of
  // missing/invalid auth does not depend on env availability.
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

  return resolveAuthContext<SendEmailAuthContext, SendEmailErrorResponse>(request, {
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
      } satisfies SendEmailAuthContext,
    }),
  });
}
