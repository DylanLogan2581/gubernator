// Runs one claimed turn job: the exact load -> simulate -> forecast -> persist
// pipeline the end-turn request used to run inline (#1278), just hosted off the
// request. Every step below is the same code the synchronous path called, so a
// fixed seed produces the same transition either way.

import { logEndTurnSuccess } from "../_shared/auditLog.ts";
import {
  logRequestEntry,
  logRequestFailure,
  logRequestSuccess,
} from "../_shared/edgeRequestLogger.ts";
import { computeForecastSnapshot } from "../end-turn-simulation/forecast.ts";
import {
  failStuckTurnTransition,
  persistSimulationTransition,
  startTurnTransition,
} from "../end-turn-simulation/persist.ts";
import { resolveServiceRoleEndTurnSimulationInput } from "../end-turn-simulation/state.ts";
import { planSimulationTransition } from "../end-turn-simulation/transition.ts";

import {
  completeTurnJob,
  failTurnJob,
  heartbeatTurnJob,
  isTransitionRunning,
  setTransitionProgress,
} from "./queue.ts";

import type { ServiceRoleConfig, TurnJobClaim } from "./queue.ts";

// A claim goes stale after 2 minutes without a heartbeat (claim_turn_job's
// default), so beat well inside that while a long turn simulates.
const HEARTBEAT_INTERVAL_MS = 20_000;

// The whole point of running off the request is not being bound by its 30s
// budget: loading a large world and applying its turn are each single calls
// that can run for minutes. The claim heartbeat, not this timeout, is what
// bounds a wedged worker.
const BACKGROUND_RPC_TIMEOUT_MS = 600_000;

export type TurnJobOutcome = {
  readonly jobId: string;
  readonly reason?: string;
  readonly status: "abandoned" | "completed" | "failed";
  readonly transitionId?: string;
  readonly worldId: string;
};

// Thrown when the claim is lost mid-run (another worker took over after this
// one's heartbeat went stale). The new claimant owns the turn; this one must
// touch neither the transition nor the job.
class ClaimLostError extends Error {
  constructor() {
    super("turn job claim lost");
    this.name = "ClaimLostError";
  }
}

export async function runTurnJob(
  config: ServiceRoleConfig,
  workerId: string,
  claim: TurnJobClaim,
  requestId: string,
): Promise<TurnJobOutcome> {
  logRequestEntry(requestId, workerId, "turn_worker_run_job", claim.worldId);

  const actorUserId = claim.enqueuedByUserId;

  if (actorUserId === null) {
    const reason = "turn job has no enqueuing user to attribute the transition to";
    await failTurnJob(config, claim.jobId, workerId, reason, requestId);
    logRequestFailure(requestId, "turn_worker_job_failed", reason);
    return { jobId: claim.jobId, reason, status: "failed", worldId: claim.worldId };
  }

  const body = {
    expectedTurnNumber: claim.fromTurnNumber,
    worldId: claim.worldId,
  };
  const authContext = { userId: actorUserId };

  let transitionId: string | null = null;
  let heartbeatTimer: number | undefined;

  try {
    // Reuse the transition the request opened; on a retry that row is already
    // terminal, so open a fresh one instead of applying against a failed turn.
    const enqueuedTransitionId = claim.turnTransitionId;
    const canReuse = enqueuedTransitionId !== null &&
      (await isTransitionRunning(config, enqueuedTransitionId, requestId));

    if (canReuse && enqueuedTransitionId !== null) {
      transitionId = enqueuedTransitionId;
    } else {
      const startResult = await startTurnTransition(
        body,
        authContext,
        BACKGROUND_RPC_TIMEOUT_MS,
      );

      if (!startResult.ok) {
        throw new Error(startResult.error.error.message);
      }

      transitionId = startResult.transitionId;
    }

    await requireClaim(config, claim.jobId, workerId, transitionId, requestId);

    // Keep the claim alive across the long stretches below; the explicit
    // fences either side of the apply are what actually gate the write.
    const heldTransitionId = transitionId;
    heartbeatTimer = setInterval(() => {
      void heartbeatTurnJob(config, claim.jobId, workerId, heldTransitionId, requestId);
    }, HEARTBEAT_INTERVAL_MS);

    await setTransitionProgress(config, transitionId, "loading", requestId);

    const stateResult = await resolveServiceRoleEndTurnSimulationInput(
      body,
      BACKGROUND_RPC_TIMEOUT_MS,
    );

    if (!stateResult.ok) {
      throw new Error(stateResult.error.error.message);
    }

    await setTransitionProgress(config, transitionId, "simulating", requestId);

    const transitionResult = await planSimulationTransition(stateResult.input, transitionId);

    if (!transitionResult.ok) {
      throw new Error(transitionResult.error.error.message);
    }

    const forecastSnapshot = computeForecastSnapshot(
      transitionResult.result,
      stateResult.input,
    );

    // Last fence before the only write that advances the world. If the claim
    // was stolen while this worker was simulating, the thief is running the
    // same turn and applying here would be the double-apply. (apply's own
    // drift and expected-turn guards would also refuse the second write, but
    // there is no reason to race them.)
    await requireClaim(config, claim.jobId, workerId, transitionId, requestId);
    await setTransitionProgress(config, transitionId, "persisting", requestId);

    const persistResult = await persistSimulationTransition(
      body,
      transitionResult.payload,
      transitionId,
      actorUserId,
      forecastSnapshot,
      BACKGROUND_RPC_TIMEOUT_MS,
    );

    if (!persistResult.ok) {
      throw new Error(persistResult.error.error.message);
    }

    await setTransitionProgress(config, transitionId, null, requestId);

    // Idempotent: completing an already-completed job is a no-op, so a retried
    // invocation after a lost response cannot double-terminate the job.
    await completeTurnJob(config, claim.jobId, workerId, requestId);

    logEndTurnSuccess(
      actorUserId,
      claim.worldId,
      persistResult.summary.fromTurnNumber,
      persistResult.summary.toTurnNumber,
      transitionId,
    );
    logRequestSuccess(requestId, "turn_worker_job_completed");

    return {
      jobId: claim.jobId,
      status: "completed",
      transitionId,
      worldId: claim.worldId,
    };
  } catch (error) {
    if (error instanceof ClaimLostError) {
      logRequestFailure(requestId, "turn_worker_claim_lost", error.message);
      return {
        jobId: claim.jobId,
        reason: error.message,
        status: "abandoned",
        worldId: claim.worldId,
      };
    }

    const reason = error instanceof Error ? error.message : "unexpected worker error";

    // Free the world before releasing the claim: a transition left 'running'
    // blocks every subsequent enqueue for this world, including the retry.
    if (transitionId !== null) {
      await failStuckTurnTransition(claim.worldId, transitionId, actorUserId, reason);
    }

    await failTurnJob(config, claim.jobId, workerId, reason, requestId);
    logRequestFailure(requestId, "turn_worker_job_failed", reason);

    return {
      jobId: claim.jobId,
      reason,
      status: "failed",
      transitionId: transitionId ?? undefined,
      worldId: claim.worldId,
    };
  } finally {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
    }
  }
}

async function requireClaim(
  config: ServiceRoleConfig,
  jobId: string,
  workerId: string,
  transitionId: string,
  requestId: string,
): Promise<void> {
  const held = await heartbeatTurnJob(config, jobId, workerId, transitionId, requestId);

  if (!held) {
    throw new ClaimLostError();
  }
}
