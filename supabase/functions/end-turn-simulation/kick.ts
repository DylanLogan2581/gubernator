// Fire-and-forget nudge that wakes the turn-worker function right after a job
// is queued (#1278).
//
// This is deliberately NOT the delivery mechanism: the durable queue is. If the
// nudge is dropped, rejected, or never sent (missing config, cold isolate torn
// down early), the job stays 'pending' and the next worker invocation claims
// it. So nothing here throws and nothing here is awaited by the request.

import { logCaughtError } from "../_shared/edgeRequestLogger.ts";
import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";

// Supabase's edge runtime exposes waitUntil to keep background work alive after
// the response is returned. It is absent under vitest and under plain Deno.
type BackgroundTaskRuntime = {
  waitUntil(promise: Promise<unknown>): void;
};

declare const EdgeRuntime: BackgroundTaskRuntime | undefined;

function getBackgroundTaskRuntime(): BackgroundTaskRuntime | undefined {
  return typeof EdgeRuntime === "undefined" ? undefined : EdgeRuntime;
}

export function kickTurnWorker(requestId: string): void {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined || supabaseServiceRoleKey === undefined) {
    return;
  }

  const pending = fetch(`${supabaseUrl}/functions/v1/turn-worker`, {
    body: JSON.stringify({ reason: "end_turn_enqueued" }),
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  }).then(
    () => undefined,
    () => {
      logCaughtError(requestId, "fetch_error", "Failed to nudge the turn worker");
    },
  );

  getBackgroundTaskRuntime()?.waitUntil(pending);
}
