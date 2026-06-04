// Phase: construction — distributes settlement-wide worker pool across project queue.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  BuildingCreated,
  ConstructionUpdate,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseConstructionOutput = {
  readonly buildingsCreated: readonly BuildingCreated[];
  readonly constructionUpdates: readonly ConstructionUpdate[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phaseConstruction(
  context: SimulationContext,
): PhaseConstructionOutput {
  const {
    buildingTiers,
    citizenAssignments,
    citizens,
    constructionProjects,
    settlements,
    stockpiles,
  } = context.input;

  const buildingTierById = new Map(buildingTiers.map((t) => [t.id, t]));
  const citizenById = new Map(citizens.map((c) => [c.id, c]));

  // Build mutable stockpile quantity map.
  const stockpileQty = new Map<string, number>();
  for (const sp of stockpiles) {
    stockpileQty.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  // Count construction pool per settlement from all construction_project assignments.
  const poolBySettlement = new Map<string, number>();
  for (const assignment of citizenAssignments) {
    if (assignment.assignmentType !== "construction_project") continue;
    const citizen = citizenById.get(assignment.citizenId);
    if (citizen === undefined || citizen.settlementId === null) continue;
    const sid = citizen.settlementId;
    poolBySettlement.set(sid, (poolBySettlement.get(sid) ?? 0) + 1);
  }

  // Collect actionable projects per settlement, sorted by queue_position ascending.
  type ProjectEntry = (typeof constructionProjects)[number];
  const projectsBySettlement = new Map<string, ProjectEntry[]>();
  for (const project of constructionProjects) {
    if (project.status !== "in_progress" && project.status !== "queued")
      continue;
    const sid = project.settlementId;
    const arr = projectsBySettlement.get(sid);
    if (arr === undefined) {
      projectsBySettlement.set(sid, [project]);
    } else {
      arr.push(project);
    }
  }
  for (const arr of projectsBySettlement.values()) {
    arr.sort((a, b) => a.queuePosition - b.queuePosition);
  }

  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allConstructionUpdates: ConstructionUpdate[] = [];
  const allBuildingsCreated: BuildingCreated[] = [];
  const allStockpileDeltas: StockpileDelta[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;
    let pool = poolBySettlement.get(sid) ?? 0;
    if (pool === 0) continue;

    const projects = projectsBySettlement.get(sid) ?? [];

    for (const project of projects) {
      if (pool === 0) break;

      const tier = buildingTierById.get(project.targetTierId);
      if (tier === undefined) continue;

      const workers = pool;

      // Check whether the stockpile can cover construction costs × allocated workers.
      let canPay = true;
      for (const cost of tier.constructionCostsJson) {
        const required = cost.amount * workers;
        const available = stockpileQty.get(`${sid}:${cost.resourceId}`) ?? 0;
        if (available < required) {
          canPay = false;
          break;
        }
      }

      if (!canPay) {
        allConstructionUpdates.push({
          progressWorkerTurnsDelta: 0,
          projectId: project.id,
          settlementId: sid,
          toStatus: "paused",
        });
        allLogs.push({
          category: "construction.paused",
          payload: {
            projectId: project.id,
            workers,
          },
          phase: "construction",
          settlementId: sid,
        });
        allNotifications.push({
          messageText: `A construction project in "${settlement.name}" was paused due to insufficient resources.`,
          notificationType: "construction.paused",
          scope: "settlement",
          settlementId: sid,
        });
        continue;
      }

      // Deduct construction costs from stockpile.
      const costsDeducted: Record<string, number> = {};
      for (const cost of tier.constructionCostsJson) {
        const consumed = cost.amount * workers;
        costsDeducted[cost.resourceId] = consumed;
        const key = `${sid}:${cost.resourceId}`;
        allStockpileDeltas.push({
          delta: -consumed,
          resourceId: cost.resourceId,
          settlementId: sid,
        });
        stockpileQty.set(key, (stockpileQty.get(key) ?? 0) - consumed);
      }

      const newProgress = project.progressWorkerTurns + workers;
      const isComplete = newProgress >= project.workerTurnsRequired;
      pool -= workers;

      const toStatus = isComplete
        ? "complete"
        : project.status === "queued"
          ? "in_progress"
          : null;

      allConstructionUpdates.push({
        progressWorkerTurnsDelta: workers,
        projectId: project.id,
        settlementId: sid,
        toStatus,
      });

      if (isComplete) {
        allBuildingsCreated.push({
          buildingBlueprintId: project.buildingBlueprintId,
          settlementId: sid,
          tierId: project.targetTierId,
        });
        allLogs.push({
          category: "construction.completed",
          payload: {
            costsDeducted,
            newProgress,
            projectId: project.id,
            workers,
            workerTurnsRequired: project.workerTurnsRequired,
          },
          phase: "construction",
          settlementId: sid,
        });
        allNotifications.push({
          messageText: `Construction completed in "${settlement.name}".`,
          notificationType: "construction.completed",
          scope: "settlement",
          settlementId: sid,
        });
      } else {
        allLogs.push({
          category: "construction.progress",
          payload: {
            costsDeducted,
            newProgress,
            projectId: project.id,
            settlementId: sid,
            workers,
            workerTurnsRequired: project.workerTurnsRequired,
          },
          phase: "construction",
        });
      }
    }
  }

  return {
    buildingsCreated: allBuildingsCreated,
    constructionUpdates: allConstructionUpdates,
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allStockpileDeltas,
  };
}
