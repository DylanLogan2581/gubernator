// Phase: construction — distributes construction workers across project queue.
//
// Workers with a non-null constructionProjectId are assigned to that specific
// project. Workers with constructionProjectId = null form a settlement-wide
// pool that fills projects without explicit assignments, in queue order.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  AssignmentClear,
  BuildingCreated,
  ConstructionUpdate,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseConstructionOutput = {
  readonly assignmentClears: readonly AssignmentClear[];
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

  // Separate per-project workers (non-null constructionProjectId) from pool
  // workers (null constructionProjectId). Per-project workers go to their
  // assigned project; pool workers fill projects without explicit assignments.
  const perProjectWorkerIds = new Map<string, string[]>();
  const poolWorkersBySid = new Map<string, string[]>();

  for (const assignment of citizenAssignments) {
    if (assignment.assignmentType !== "construction_project") continue;
    const citizen = citizenById.get(assignment.citizenId);
    if (citizen === undefined || citizen.settlementId === null) continue;
    const sid = citizen.settlementId;

    if (assignment.constructionProjectId !== null) {
      let arr = perProjectWorkerIds.get(assignment.constructionProjectId);
      if (arr === undefined) {
        arr = [];
        perProjectWorkerIds.set(assignment.constructionProjectId, arr);
      }
      arr.push(assignment.citizenId);
    } else {
      let arr = poolWorkersBySid.get(sid);
      if (arr === undefined) {
        arr = [];
        poolWorkersBySid.set(sid, arr);
      }
      arr.push(assignment.citizenId);
    }
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

  const allAssignmentClears: AssignmentClear[] = [];
  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allConstructionUpdates: ConstructionUpdate[] = [];
  const allBuildingsCreated: BuildingCreated[] = [];
  const allStockpileDeltas: StockpileDelta[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;
    const poolWorkers = poolWorkersBySid.get(sid) ?? [];
    let remainingPool = poolWorkers.length;
    const projects = projectsBySettlement.get(sid) ?? [];

    for (const project of projects) {
      const explicitWorkers = perProjectWorkerIds.get(project.id) ?? [];
      const explicitCount = explicitWorkers.length;

      let workers: number;
      let useExplicit: boolean;

      if (explicitCount > 0) {
        workers = explicitCount;
        useExplicit = true;
      } else if (remainingPool > 0) {
        workers = remainingPool;
        useExplicit = false;
      } else {
        continue;
      }

      const tier = buildingTierById.get(project.targetTierId);
      if (tier === undefined) continue;

      // Check whether the stockpile can cover construction costs × workers.
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

      // Deduct pool count only after a successful resource check.
      if (!useExplicit) {
        remainingPool -= workers;
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
        // Release only the workers that contributed to this project.
        const workersToRelease = useExplicit ? explicitWorkers : poolWorkers;
        for (const citizenId of workersToRelease) {
          allAssignmentClears.push({
            citizenId,
            reason: "construction_project_completed",
          });
        }

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
    assignmentClears: allAssignmentClears,
    buildingsCreated: allBuildingsCreated,
    constructionUpdates: allConstructionUpdates,
    logs: allLogs,
    notifications: allNotifications,
    stockpileDeltas: allStockpileDeltas,
  };
}
