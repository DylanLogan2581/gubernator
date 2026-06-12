// Forecast computation: extracts key simulation outcomes organized by settlement
// for player preview without persisting to DB.

import type {
  SimulationInputState,
  SimulationResult,
} from "../_shared/simulation/simulationTypes.ts";

// ---------------------------------------------------------------------------
// Forecast types
// ---------------------------------------------------------------------------

export type SettlementForecast = {
  readonly settlementId: string;
  // Resource deltas: per-resource changes (production - consumption + trade)
  readonly resourceDeltas: ReadonlyArray<{
    readonly resourceId: string;
    readonly produced: number;
    readonly consumed: number;
    readonly tradeIn: number;
    readonly tradeOut: number;
    readonly netDelta: number;
    readonly quantityBefore: number;
    readonly quantityAfter: number;
  }>;
  // Deaths by cause: starvation, homelessness, other
  readonly deathsBy: {
    readonly starvation: number;
    readonly homelessness: number;
    readonly other: number;
  };
  // Construction completions: project IDs transitioning to 'completed'
  readonly completedProjects: readonly string[];
  // Building upkeep failures: building IDs with missed upkeep increases
  readonly buildingUpkeepFailures: readonly string[];
  // Trade route changes: which routes pause and why
  readonly tradeChanges: ReadonlyArray<{
    readonly tradeRouteId: string;
    readonly delivered: boolean;
    readonly pauseReason: string | null;
    readonly quantityTransferred: number;
  }>;
};

export type ForecastSnapshot = {
  readonly bySettlement: {
    readonly [settlementId: string]: SettlementForecast;
  };
};

// ---------------------------------------------------------------------------
// computeForecastSnapshot
// ---------------------------------------------------------------------------

export function computeForecastSnapshot(
  simulationResult: SimulationResult,
  input: SimulationInputState,
): ForecastSnapshot {
  const projectById = new Map(input.constructionProjects.map((p) => [p.id, p]));

  // Initialize forecast by settlement (mutable during construction)
  const bySettlement: {
    [settlementId: string]: {
      settlementId: string;
      resourceDeltas: Array<{
        readonly resourceId: string;
        readonly produced: number;
        readonly consumed: number;
        readonly tradeIn: number;
        readonly tradeOut: number;
        readonly netDelta: number;
        readonly quantityBefore: number;
        readonly quantityAfter: number;
      }>;
      deathsBy: {
        starvation: number;
        homelessness: number;
        other: number;
      };
      completedProjects: string[];
      buildingUpkeepFailures: string[];
      tradeChanges: Array<{
        readonly tradeRouteId: string;
        readonly delivered: boolean;
        readonly pauseReason: string | null;
        readonly quantityTransferred: number;
      }>;
    };
  } = {};

  for (const settlement of input.settlements) {
    bySettlement[settlement.id] = {
      settlementId: settlement.id,
      resourceDeltas: [],
      deathsBy: { starvation: 0, homelessness: 0, other: 0 },
      completedProjects: [],
      buildingUpkeepFailures: [],
      tradeChanges: [],
    };
  }

  // Populate resource deltas from resourceSnapshots
  const resourceDeltasBySettlement = new Map<
    string,
    Array<{
      readonly resourceId: string;
      readonly produced: number;
      readonly consumed: number;
      readonly tradeIn: number;
      readonly tradeOut: number;
      readonly netDelta: number;
      readonly quantityBefore: number;
      readonly quantityAfter: number;
    }>
  >();
  for (const snap of simulationResult.resourceSnapshots) {
    const deltas = resourceDeltasBySettlement.get(snap.settlementId) ?? [];
    deltas.push({
      resourceId: snap.resourceId,
      produced: snap.produced,
      consumed: snap.consumed,
      tradeIn: snap.tradeIn,
      tradeOut: snap.tradeOut,
      netDelta: snap.quantityAfter - snap.quantityBefore,
      quantityBefore: snap.quantityBefore,
      quantityAfter: snap.quantityAfter,
    });
    resourceDeltasBySettlement.set(snap.settlementId, deltas);
  }

  // Construction completions
  for (const update of simulationResult.constructionUpdates) {
    if (update.toStatus === "complete") {
      const project = projectById.get(update.projectId);
      if (project !== undefined) {
        const forecast = bySettlement[project.settlementId];
        if (forecast !== undefined) {
          forecast.completedProjects.push(update.projectId);
        }
      }
    }
  }

  // Building upkeep failures (missed upkeep count increases)
  for (const change of simulationResult.buildingStateChanges) {
    if (change.missedUpkeepCountDelta !== null && change.missedUpkeepCountDelta > 0) {
      const building = input.settlementBuildings.find(
        (b) => b.id === change.settlementBuildingId,
      );
      if (building !== undefined) {
        const forecast = bySettlement[building.settlementId];
        if (forecast !== undefined) {
          forecast.buildingUpkeepFailures.push(change.settlementBuildingId);
        }
      }
    }
  }

  // Trade route changes
  for (const outcome of simulationResult.tradeRouteOutcomes) {
    const route = input.tradeRoutes.find((r) => r.id === outcome.tradeRouteId);
    if (route !== undefined) {
      const forecast = bySettlement[route.originSettlementId];
      if (forecast !== undefined) {
        forecast.tradeChanges.push({
          tradeRouteId: outcome.tradeRouteId,
          delivered: outcome.delivered,
          pauseReason: outcome.pauseReason,
          quantityTransferred: outcome.quantityTransferred,
        });
      }
    }
  }

  // Assign resource deltas
  for (const [settlementId, deltas] of resourceDeltasBySettlement) {
    const forecast = bySettlement[settlementId];
    if (forecast !== undefined) {
      forecast.resourceDeltas = deltas;
    }
  }

  // Convert mutable structure to immutable result type
  const result: ForecastSnapshot = {
    bySettlement: Object.fromEntries(
      Object.entries(bySettlement).map(([id, forecast]) => [
        id,
        {
          settlementId: forecast.settlementId,
          resourceDeltas: Object.freeze([...forecast.resourceDeltas]),
          deathsBy: forecast.deathsBy,
          completedProjects: Object.freeze([...forecast.completedProjects]),
          buildingUpkeepFailures: Object.freeze([...forecast.buildingUpkeepFailures]),
          tradeChanges: Object.freeze([...forecast.tradeChanges]),
        },
      ]),
    ),
  };
  return result;
}
