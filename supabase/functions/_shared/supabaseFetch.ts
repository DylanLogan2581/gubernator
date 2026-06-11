/**
 * Timeout-bearing fetch wrapper for Supabase REST/GoTrue API access.
 * All requests carry an AbortSignal timeout so hung connections fail fast
 * rather than stalling until the platform wall-clock limit.
 */

/**
 * Standard headers for Supabase REST/GoTrue endpoints.
 */
export type SupabaseHeaders = {
  readonly apikey: string;
  readonly authorization: string;
};

type TimeoutCapable = { timeout(ms: number): AbortSignal };

/**
 * Classify HTTP status code as client error (4xx) vs server error (5xx).
 * Used to distinguish retryable (5xx) from non-retryable (4xx) errors.
 *
 * @param status - HTTP status code
 * @returns Object with safeDeny flag: true if 4xx, false if 5xx
 */
export function classifyHttpError(status: number): {
  readonly safeDeny: boolean;
} {
  return { safeDeny: status >= 400 && status < 500 };
}

/**
 * Fetch wrapper for Supabase endpoints with request timeout.
 *
 * @param url - Full URL to Supabase endpoint
 * @param options - Fetch options (headers, method, body)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Response from Supabase
 * @throws AbortError if request times out
 */
export function supabaseFetch(
  url: string,
  options: {
    readonly headers: Record<string, string>;
    readonly method?: string;
    readonly body?: string;
  },
  timeoutMs: number = 30000,
): Promise<Response> {
  // Use native AbortSignal.timeout() for clean timeout handling.
  // If AbortSignal.timeout is not available (pre-ES2024), fall back to
  // AbortController + setTimeout pattern.
  let signal: AbortSignal;

  if ("timeout" in AbortSignal) {
    // Modern API (ES2024+, Deno >= 1.40)
    signal = (AbortSignal as TimeoutCapable).timeout(timeoutMs);
  } else {
    // Fallback to AbortController pattern
    const controller = new AbortController();
    // Set timeout but don't capture it (cleanup is handled elsewhere in practice)
    setTimeout(() => controller.abort(), timeoutMs);
    signal = controller.signal;
  }

  return fetch(url, {
    ...options,
    signal,
  });
}
