// Phase: standard jobs.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { scaleDeficit } from "../decimalMath.ts";

import type {
  SimJob,
  SimulationContext,
  SimulationLogEntry,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseStandardJobsOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phaseStandardJobs(
  context: SimulationContext,
): PhaseStandardJobsOutput {
  const { citizenAssignments, citizens, jobs, settlements, stockpiles } = context.input;
  const { pendingEventMultipliers } = context.shared;

  const citizenById = new Map(citizens.map((c) => [c.id, c]));

  const stockpileQty = new Map<string, number>();
  for (const sp of stockpiles) {
    stockpileQty.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  const workerCounts = new Map<string, number>();
  for (const assignment of citizenAssignments) {
    if (
      assignment.assignmentType !== "standard_job" ||
      assignment.jobId === null
    ) {
      continue;
    }
    const citizen = citizenById.get(assignment.citizenId);
    if (citizen === undefined || citizen.settlementId === null) continue;
    const key = `${citizen.settlementId}:${assignment.jobId}`;
    workerCounts.set(key, (workerCounts.get(key) ?? 0) + 1);
  }

  const standardJobs = jobs.filter((j) => j.jobType === "standard");

  const allLogs: SimulationLogEntry[] = [];
  const allDeltas: StockpileDelta[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;

    const activeJobs: { job: SimJob; workerCount: number }[] = [];
    for (const job of standardJobs) {
      const workers = workerCounts.get(`${sid}:${job.id}`) ?? 0;
      if (workers === 0) continue;
      activeJobs.push({ job, workerCount: workers });
    }

    if (activeJobs.length === 0) continue;

    // Sum total required per input resource across all active jobs in this settlement.
    const totalRequired = new Map<string, number>();
    for (const { job, workerCount } of activeJobs) {
      for (const input of job.inputsJson) {
        const required = workerCount * input.amountPerWorker;
        totalRequired.set(
          input.resourceId,
          (totalRequired.get(input.resourceId) ?? 0) + required,
        );
      }
    }

    // Per-resource scale factor derived from total demand vs. available stock.
    const resourceScale = new Map<string, number>();
    for (const [resourceId, required] of totalRequired) {
      const available = stockpileQty.get(`${sid}:${resourceId}`) ?? 0;
      resourceScale.set(resourceId, scaleDeficit(required, available));
    }

    const settlementMults = pendingEventMultipliers.get(sid);

    for (const { job, workerCount } of activeJobs) {
      // Scale by the tightest input constraint (min across all input resources).
      let jobScale = 1.0;
      for (const input of job.inputsJson) {
        const scale = resourceScale.get(input.resourceId) ?? 1.0;
        if (scale < jobScale) jobScale = scale;
      }

      const inputsConsumed: Record<string, number> = {};
      for (const input of job.inputsJson) {
        const consumed = jobScale * workerCount * input.amountPerWorker;
        inputsConsumed[input.resourceId] = consumed;
        allDeltas.push({
          delta: -consumed,
          resourceId: input.resourceId,
          settlementId: sid,
        });
      }

      const outputsProduced: Record<string, number> = {};
      // Apply production multipliers: job-specific first, then building-specific.
      const jobMultiplier = settlementMults?.productionByJobId.get(job.id) ?? 1.0;
      for (const output of job.outputsJson) {
        const produced = jobScale * workerCount * output.amountPerWorker * jobMultiplier;
        outputsProduced[output.resourceId] = produced;
        allDeltas.push({
          delta: produced,
          resourceId: output.resourceId,
          settlementId: sid,
        });
      }

      allLogs.push({
        category: "standard_job.processed",
        nationId: settlement.nationId,
        payload: {
          inputsConsumed,
          jobId: job.id,
          outputsProduced,
          scale: jobScale,
          settlementId: sid,
          workerCount,
        },
        phase: "standardJobs",
        settlementId: sid,
      });
    }
  }

  return { logs: allLogs, stockpileDeltas: allDeltas };
}
