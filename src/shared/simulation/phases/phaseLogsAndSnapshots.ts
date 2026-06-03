// Phase: logs and snapshots — builds settlementSnapshots and resourceSnapshots
// from the accumulated state of all prior phases.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { buildResourceSnapshots } from "../outcomes/resourceSnapshotBuilder.ts";
import { buildSettlementSnapshots } from "../outcomes/settlementSnapshotBuilder.ts";

import type {
  BuildingStateChange,
  CitizenBirth,
  CitizenDeath,
  DepositUpdate,
  ManagedPopulationUpdate,
  PartnershipChange,
  ResourceSnapshot,
  SettlementSnapshot,
  SimulationContext,
  SimulationLogEntry,
  StockpileDelta,
  TradeRouteOutcome,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Accumulator — collects outputs of all prior phases for snapshot building
// ---------------------------------------------------------------------------

export type PhaseLogsAndSnapshotsAccumulator = {
  readonly allDeaths: readonly CitizenDeath[];
  readonly buildingStateChanges: readonly BuildingStateChange[];
  readonly citizenBirths: readonly CitizenBirth[];
  // Negative deltas from consumption phases (upkeep, citizen consumption, etc.)
  readonly consumptionDeltas: readonly StockpileDelta[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly managedPopulationUpdates: readonly ManagedPopulationUpdate[];
  readonly partnershipChanges: readonly PartnershipChange[];
  // Post-clamp quantities keyed by "settlementId:resourceId"
  readonly pendingStockpiles: ReadonlyMap<string, number>;
  // Positive deltas from production phases (jobs, deposits, passive effects, etc.)
  readonly productionDeltas: readonly StockpileDelta[];
  readonly tradeRouteDeltas: readonly StockpileDelta[];
  readonly tradeRouteOutcomes: readonly TradeRouteOutcome[];
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type PhaseLogsAndSnapshotsOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly resourceSnapshots: readonly ResourceSnapshot[];
  readonly settlementSnapshots: readonly SettlementSnapshot[];
};

// ---------------------------------------------------------------------------
// Phase entry point
// ---------------------------------------------------------------------------

export function phaseLogsAndSnapshots(
  context: SimulationContext,
  accumulator: PhaseLogsAndSnapshotsAccumulator,
): PhaseLogsAndSnapshotsOutput {
  const {
    allDeaths,
    buildingStateChanges,
    citizenBirths,
    consumptionDeltas,
    depositUpdates,
    managedPopulationUpdates,
    partnershipChanges,
    pendingStockpiles,
    productionDeltas,
    tradeRouteDeltas,
    tradeRouteOutcomes,
  } = accumulator;

  const settlementSnapshots = buildSettlementSnapshots(context, {
    allDeaths,
    buildingStateChanges,
    citizenBirths,
    depositUpdates,
    managedPopulationUpdates,
    partnershipChanges,
    tradeRouteOutcomes,
  });

  const resourceSnapshots = buildResourceSnapshots(context, {
    consumptionDeltas,
    pendingStockpiles,
    productionDeltas,
    tradeRouteDeltas,
  });

  return {
    logs: [],
    resourceSnapshots,
    settlementSnapshots,
  };
}
