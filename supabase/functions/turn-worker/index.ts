// Background turn worker (#1278, phase 4 of the database scaling roadmap).
//
// The end-turn request no longer simulates: it opens the transition, queues a
// turn_jobs row, and returns. This function is the consumer. It claims jobs off
// that queue and runs the unchanged load -> simulate -> forecast -> persist
// pipeline, so nothing about the turn's result depends on the host.
//
// Invocation: any POST with the service-role key. In practice that is the
// fire-and-forget nudge the end-turn function sends after enqueueing; because
// claiming is the source of truth, an extra, duplicate, or late invocation is
// harmless -- it either finds work or returns claimed: 0.

import { generateRequestId, logRequestSuccess } from "../_shared/edgeRequestLogger.ts";
import {
  EDGE_COMMON_ENV_VAR_NAMES,
  EDGE_SERVICE_ROLE_ENV_VAR_NAMES,
} from "../_shared/envContract.ts";
import {
  assertEdgeEnvVars,
  getEdgeRuntime,
  getRequiredRuntimeEnv,
} from "../_shared/http/env.ts";

import { claimTurnJob, resolveServiceRoleConfig } from "./queue.ts";
import { runTurnJob } from "./runTurnJob.ts";

import type { TurnJobOutcome } from "./runTurnJob.ts";

// A single invocation drains a few jobs so a queue that backed up behind a
// crashed worker recovers without needing one nudge per job. The cap keeps the
// invocation inside its runtime budget.
const MAX_JOBS_PER_INVOCATION = 3;

export type TurnWorkerResponseBody = {
  readonly claimed: number;
  readonly outcomes: readonly TurnJobOutcome[];
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

export async function handleTurnWorkerRequest(request: Request): Promise<Response> {
  const requestId = generateRequestId();

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to run the turn worker." }, 405);
  }

  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (serviceRoleKey === undefined) {
    return jsonResponse({ error: "Turn worker is not configured." }, 500);
  }

  // The platform's JWT verification would admit any signed token, including an
  // end user's. This function is system-only, so require the service-role key
  // itself -- the same secret the claim RPCs are granted to.
  if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: "Turn worker requires the service role." }, 403);
  }

  const config = resolveServiceRoleConfig();

  if (config === undefined) {
    return jsonResponse({ error: "Turn worker is not configured." }, 500);
  }

  const workerId = `turn-worker:${requestId}`;
  const outcomes: TurnJobOutcome[] = [];

  while (outcomes.length < MAX_JOBS_PER_INVOCATION) {
    const claim = await claimTurnJob(config, workerId, requestId);

    if (claim === null) {
      break;
    }

    outcomes.push(await runTurnJob(config, workerId, claim, requestId));
  }

  logRequestSuccess(requestId, `turn_worker_drained:${String(outcomes.length)}`);

  return jsonResponse({ claimed: outcomes.length, outcomes }, 200);
}

assertEdgeEnvVars([...EDGE_COMMON_ENV_VAR_NAMES, ...EDGE_SERVICE_ROLE_ENV_VAR_NAMES]);

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleTurnWorkerRequest);
}
