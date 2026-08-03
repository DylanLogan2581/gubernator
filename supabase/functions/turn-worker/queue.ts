// Service-role client for the turn_jobs claim protocol (#1277) plus the
// worker's progress stamp on turn_transitions (#1278).
//
// Every call here uses the service-role key: claim/heartbeat/complete/fail are
// granted to service_role only, and the worker has no end user's JWT.

import { logCaughtError } from "../_shared/edgeRequestLogger.ts";
import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

export type TurnJobClaim = {
  readonly attempts: number;
  readonly enqueuedByUserId: string | null;
  readonly fromTurnNumber: number;
  readonly jobId: string;
  readonly maxAttempts: number;
  readonly turnTransitionId: string | null;
  readonly worldId: string;
};

export type TurnTransitionProgressStage =
  | "loading"
  | "persisting"
  | "queued"
  | "simulating";

export type ServiceRoleConfig = {
  readonly headers: Record<string, string>;
  readonly supabaseUrl: string;
};

export function resolveServiceRoleConfig(): ServiceRoleConfig | undefined {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl === undefined || supabaseServiceRoleKey === undefined) {
    return undefined;
  }

  return {
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json",
    },
    supabaseUrl,
  };
}

async function callRpc(
  config: ServiceRoleConfig,
  name: string,
  params: Record<string, unknown>,
  requestId: string,
): Promise<unknown> {
  let response: Response;

  try {
    response = await supabaseFetch(
      `${config.supabaseUrl}/rest/v1/rpc/${name}`,
      { body: JSON.stringify(params), headers: config.headers, method: "POST" },
      30000,
    );
  } catch {
    logCaughtError(requestId, "fetch_error", `Failed to reach ${name}`);
    throw new Error(`${name} is unreachable`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logCaughtError(requestId, "rpc_error", `${name} failed: ${detail}`);
    throw new Error(`${name} failed with status ${String(response.status)}`);
  }

  return await response.json().catch(() => null);
}

export async function claimTurnJob(
  config: ServiceRoleConfig,
  workerId: string,
  requestId: string,
): Promise<TurnJobClaim | null> {
  const claim = await callRpc(config, "claim_turn_job", { p_worker_id: workerId }, requestId);

  return toTurnJobClaim(claim);
}

// Returns false once the claim has been lost -- the job was re-claimed by
// another worker after this one's heartbeat went stale, or it is already
// terminal. The caller must stop working when that happens: the other claimant
// owns the turn now.
export async function heartbeatTurnJob(
  config: ServiceRoleConfig,
  jobId: string,
  workerId: string,
  transitionId: string | null,
  requestId: string,
): Promise<boolean> {
  const held = await callRpc(
    config,
    "heartbeat_turn_job",
    { p_job_id: jobId, p_transition_id: transitionId, p_worker_id: workerId },
    requestId,
  );

  return held === true;
}

export async function completeTurnJob(
  config: ServiceRoleConfig,
  jobId: string,
  workerId: string,
  requestId: string,
): Promise<boolean> {
  const completed = await callRpc(
    config,
    "complete_turn_job",
    { p_job_id: jobId, p_worker_id: workerId },
    requestId,
  );

  return completed === true;
}

// Releases the claim. Below max_attempts the job returns to 'pending' and is
// re-claimable; at max_attempts it is retired as 'failed'.
export async function failTurnJob(
  config: ServiceRoleConfig,
  jobId: string,
  workerId: string,
  error: string,
  requestId: string,
): Promise<void> {
  try {
    await callRpc(
      config,
      "fail_turn_job",
      { p_error: error.slice(0, 2000), p_job_id: jobId, p_worker_id: workerId },
      requestId,
    );
  } catch {
    // Never mask the original failure that triggered this release. A job left
    // claimed is recovered by the heartbeat staleness path anyway.
    logCaughtError(requestId, "fail_turn_job_error", "Failed to release the turn job claim");
  }
}

// Best-effort: progress is cosmetic, so a failed stamp must not abort a turn.
export async function setTransitionProgress(
  config: ServiceRoleConfig,
  transitionId: string,
  stage: TurnTransitionProgressStage | null,
  requestId: string,
): Promise<void> {
  try {
    const response = await supabaseFetch(
      `${config.supabaseUrl}/rest/v1/turn_transitions?id=eq.${transitionId}`,
      {
        body: JSON.stringify({ progress_stage: stage }),
        headers: { ...config.headers, prefer: "return=minimal" },
        method: "PATCH",
      },
      30000,
    );

    if (!response.ok) {
      logCaughtError(
        requestId,
        "progress_stamp_error",
        `Progress stamp rejected: ${stage ?? "cleared"}`,
      );
    }
  } catch {
    logCaughtError(
      requestId,
      "progress_stamp_error",
      `Progress stamp failed: ${stage ?? "cleared"}`,
    );
  }
}

// Whether the transition the job was enqueued against is still usable. On a
// retry the previous transition is already terminal, so the worker has to open
// a fresh one rather than re-applying against a failed row.
export async function isTransitionRunning(
  config: ServiceRoleConfig,
  transitionId: string,
  requestId: string,
): Promise<boolean> {
  let response: Response;

  try {
    response = await supabaseFetch(
      `${config.supabaseUrl}/rest/v1/turn_transitions?id=eq.${transitionId}&select=status`,
      { headers: config.headers, method: "GET" },
      30000,
    );
  } catch {
    logCaughtError(requestId, "fetch_error", "Failed to read the turn transition status");
    return false;
  }

  if (!response.ok) {
    return false;
  }

  const rows: unknown = await response.json().catch(() => null);

  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }

  const first: unknown = rows[0];

  return (
    typeof first === "object" &&
    first !== null &&
    (first as Record<string, unknown>).status === "running"
  );
}

function toTurnJobClaim(value: unknown): TurnJobClaim | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.jobId !== "string" ||
    typeof record.worldId !== "string" ||
    typeof record.fromTurnNumber !== "number" ||
    typeof record.attempts !== "number" ||
    typeof record.maxAttempts !== "number"
  ) {
    return null;
  }

  return {
    attempts: record.attempts,
    enqueuedByUserId: typeof record.enqueuedByUserId === "string"
      ? record.enqueuedByUserId
      : null,
    fromTurnNumber: record.fromTurnNumber,
    jobId: record.jobId,
    maxAttempts: record.maxAttempts,
    turnTransitionId: typeof record.turnTransitionId === "string"
      ? record.turnTransitionId
      : null,
    worldId: record.worldId,
  };
}
