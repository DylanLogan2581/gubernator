/**
 * Per-user, per-function rate limiting for privileged edge functions.
 *
 * Uses a DB-backed per-minute sliding window (edge_rate_limit_buckets table).
 * Fails open: if the DB is unreachable, requests are allowed through.
 *
 * Documented limits (requests per minute per user):
 *   admin-create-user:   10
 *   end-turn-simulation: 10
 */

import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";

export const RATE_LIMITS: Record<string, number> = {
  "admin-create-user": 10,
  "end-turn-simulation": 10,
};

export type RateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

/**
 * Check and atomically increment the per-user rate limit bucket.
 *
 * Calls `increment_rate_limit_bucket` via service_role to bypass RLS.
 * Returns ok:false with a Retry-After estimate when the limit is exceeded.
 * Returns ok:true (fail-open) if env config or the DB is unavailable.
 *
 * @param userId       - The authenticated user's ID
 * @param functionName - Edge function name (key in RATE_LIMITS)
 * @param limit        - Max requests per minute for this function
 */
export async function checkRateLimit(
  userId: string,
  functionName: string,
  limit: number,
): Promise<RateLimitResult> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    return { ok: true };
  }

  const nowMs = Date.now();
  // Truncate to the current UTC minute boundary.
  const windowMinute = new Date(nowMs - (nowMs % 60_000)).toISOString();

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/increment_rate_limit_bucket`,
      {
        body: JSON.stringify({
          p_function_name: functionName,
          p_user_id: userId,
          p_window_minute: windowMinute,
        }),
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      // Fail open on DB error.
      return { ok: true };
    }

    const count: unknown = await response.json();
    if (typeof count !== "number") {
      return { ok: true };
    }

    if (count > limit) {
      // Estimate seconds remaining in the current minute.
      const secondsIntoMinute = Math.floor((Date.now() % 60_000) / 1000);
      return { ok: false, retryAfterSeconds: 60 - secondsIntoMinute };
    }

    return { ok: true };
  } catch {
    // Network error or parse failure: fail open.
    return { ok: true };
  }
}
