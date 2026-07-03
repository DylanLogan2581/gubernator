/**
 * Per-user, per-function rate limiting for privileged edge functions.
 *
 * Uses a DB-backed per-minute sliding window (edge_rate_limit_buckets table).
 * Fails closed: if the limiter cannot be evaluated (missing env, non-2xx
 * RPC response, non-numeric count, or network/exception), the request is
 * rejected with a short retry-after rather than silently let through. All
 * callers already treat `ok: false` uniformly as 429, so this keeps the
 * documented per-user caps enforced under DB pressure or transient outages
 * instead of disappearing exactly when they matter most.
 *
 * Documented limits (requests per minute per user):
 *   admin-create-user:      10
 *   end-turn-simulation:    10
 *   export-world-template:   5 (heavier 7-table parallel read, infrequent
 *                               legitimate use — tighter cap curbs DB-load
 *                               amplification)
 */

import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";

export const RATE_LIMITS: Record<string, number> = {
  "admin-create-user": 10,
  "end-turn-simulation": 10,
  "export-world-template": 5,
};

/**
 * Retry-After (seconds) returned when the limiter itself can't be evaluated
 * (fail-closed). Short on purpose: a transient DB blip should resolve well
 * before this elapses, whereas an outage keeps failing closed on retry.
 */
const FAIL_CLOSED_RETRY_AFTER_SECONDS = 5;

export type RateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

/**
 * Check and atomically increment the per-user rate limit bucket.
 *
 * Calls `increment_rate_limit_bucket` via service_role to bypass RLS.
 * Returns ok:false with a Retry-After estimate when the limit is exceeded.
 * Also returns ok:false (fail-closed) if env config is missing, the RPC
 * responds non-2xx, the count can't be parsed, or the fetch throws — each
 * path logs loudly via console.error before returning so operators can
 * distinguish "rate limited" from "limiter broken" in logs.
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
    console.error(
      `[rateLimit] fail-closed for ${functionName}: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`,
    );
    return { ok: false, retryAfterSeconds: FAIL_CLOSED_RETRY_AFTER_SECONDS };
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
      console.error(
        `[rateLimit] fail-closed for ${functionName}: bucket RPC responded with status ${response.status}`,
      );
      return { ok: false, retryAfterSeconds: FAIL_CLOSED_RETRY_AFTER_SECONDS };
    }

    const count: unknown = await response.json();
    if (typeof count !== "number") {
      console.error(
        `[rateLimit] fail-closed for ${functionName}: bucket RPC returned a non-numeric count`,
      );
      return { ok: false, retryAfterSeconds: FAIL_CLOSED_RETRY_AFTER_SECONDS };
    }

    if (count > limit) {
      // Estimate seconds remaining in the current minute.
      const secondsIntoMinute = Math.floor((Date.now() % 60_000) / 1000);
      return { ok: false, retryAfterSeconds: 60 - secondsIntoMinute };
    }

    return { ok: true };
  } catch (error) {
    console.error(`[rateLimit] fail-closed for ${functionName}: bucket check threw`, error);
    return { ok: false, retryAfterSeconds: FAIL_CLOSED_RETRY_AFTER_SECONDS };
  }
}
