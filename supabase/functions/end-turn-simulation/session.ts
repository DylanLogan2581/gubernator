import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";
import { getAuthorizationHeader, resolveAuthContext } from "../_shared/http/session.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import { createErrorResponse } from "./http.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationAuthContextResult,
  EndTurnSimulationErrorResponse,
} from "./types.ts";

export async function resolveSupabaseSimulationAuthContext(
  request: Request,
): Promise<EndTurnSimulationAuthContextResult> {
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
    EndTurnSimulationAuthContext,
    EndTurnSimulationErrorResponse
  >(request, {
    fetchFn: (url: string, opts: RequestInit) =>
      supabaseFetch(url, {
        headers: (opts.headers as Record<string, string>) ?? {},
        method: opts.method,
        body: opts.body as string | undefined,
      }),
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
      } satisfies EndTurnSimulationAuthContext,
    }),
  });

  if (!result.ok) {
    return result;
  }

  return result;
}
