// Simulation orchestrator — runs all 13 phases in spec order and assembles
// the final SimulationResult.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { phaseBuildingUpkeep } from "./phases/phaseBuildingUpkeep.ts";
import { phaseCitizenConsumption } from "./phases/phaseCitizenConsumption.ts";
import { phaseConstruction } from "./phases/phaseConstruction.ts";
import { phaseDepositExtraction } from "./phases/phaseDepositExtraction.ts";
import { phaseEvents } from "./phases/phaseEvents.ts";
import { phaseHomelessness } from "./phases/phaseHomelessness.ts";
import { phaseLogsAndSnapshots } from "./phases/phaseLogsAndSnapshots.ts";
import { phaseManagedPopulations } from "./phases/phaseManagedPopulations.ts";
import { phasePartnerships } from "./phases/phasePartnerships/index.ts";
import { phasePassiveEffects } from "./phases/phasePassiveEffects.ts";
import { phaseStandardJobs } from "./phases/phaseStandardJobs.ts";
import { phaseStockpileClamp } from "./phases/phaseStockpileClamp.ts";
import { phaseTradeRoutes } from "./phases/phaseTradeRoutes.ts";
import { createSeededRng } from "./seededRng.ts";
import { SimulationRejectionError } from "./simulationTypes.ts";

import type {
  ReadinessSummary,
  SimulationContext,
  SimulationInputState,
  SimulationLogEntry,
  SimulationNotification,
  SimulationResult,
  StockpileDelta,
} from "./simulationTypes.ts";

export { SimulationRejectionError } from "./simulationTypes.ts";

export function runSimulation(
  input: SimulationInputState,
  transitionId: string,
): SimulationResult {
  if (input.isWorldArchived === true) {
    throw new SimulationRejectionError(
      "world_archived",
      "Cannot run simulation on an archived world.",
    );
  }

  // Build the seeded RNG from the turn transition UUID. Randomness-dependent
  // phases (e.g. partnerships) create their own phase-scoped seeds internally.
  void createSeededRng(transitionId);

  // -------------------------------------------------------------------------
  // Shared mutable state — initialized from input and updated after each phase.
  // -------------------------------------------------------------------------

  const pendingStockpiles = new Map<string, number>();
  for (const sp of input.stockpiles) {
    pendingStockpiles.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  const tierById = new Map(input.buildingTiers.map((t) => [t.id, t]));
  const buildingById = new Map(input.settlementBuildings.map((b) => [b.id, b]));

  const pendingPopCapBySettlement = new Map<string, number>();
  for (const building of input.settlementBuildings) {
    if (building.state !== "active") continue;
    const tier = tierById.get(building.currentTierId);
    if (tier === undefined) continue;
    for (const effect of tier.effectsJson) {
      if (effect.type !== "population_cap_increase") continue;
      pendingPopCapBySettlement.set(
        building.settlementId,
        (pendingPopCapBySettlement.get(building.settlementId) ?? 0) +
          effect.amount,
      );
    }
  }

  const pendingDeaths = new Set<string>();

  const context: SimulationContext = {
    input,
    shared: { pendingDeaths, pendingPopCapBySettlement, pendingStockpiles },
  };

  function applyDeltas(deltas: readonly StockpileDelta[]): void {
    for (const d of deltas) {
      const key = `${d.settlementId}:${d.resourceId}`;
      pendingStockpiles.set(key, (pendingStockpiles.get(key) ?? 0) + d.delta);
    }
  }

  // -------------------------------------------------------------------------
  // Effective storage caps — base cap + resource_storage_increase from active buildings.
  // Pre-computed once from the initial state so phaseStockpileClamp can clamp correctly.
  // -------------------------------------------------------------------------

  const effectiveStorageCaps = new Map<string, number>();
  for (const sp of input.stockpiles) {
    effectiveStorageCaps.set(`${sp.settlementId}:${sp.resourceId}`, sp.cap);
  }
  for (const building of input.settlementBuildings) {
    if (building.state !== "active") continue;
    const tier = tierById.get(building.currentTierId);
    if (tier === undefined) continue;
    for (const effect of tier.effectsJson) {
      if (effect.type !== "resource_storage_increase") continue;
      const key = `${building.settlementId}:${effect.resourceId}`;
      effectiveStorageCaps.set(
        key,
        (effectiveStorageCaps.get(key) ?? 0) + effect.amount,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Phase 1 — Standard Jobs
  // -------------------------------------------------------------------------

  const p1 = phaseStandardJobs(context);
  applyDeltas(p1.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 2 — Deposit Extraction
  // -------------------------------------------------------------------------

  const p2 = phaseDepositExtraction(context);
  applyDeltas(p2.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 3 — Construction
  // -------------------------------------------------------------------------

  const p3 = phaseConstruction(context);
  applyDeltas(p3.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 4 — Building Upkeep
  // -------------------------------------------------------------------------

  const p4 = phaseBuildingUpkeep(context);
  applyDeltas(p4.stockpileDeltas);

  // Adjust population cap contributions from buildings whose state changed this phase.
  // Suspended/auto-deconstructed buildings lose their cap; recovered buildings regain it.
  for (const change of p4.buildingStateChanges) {
    const building = buildingById.get(change.settlementBuildingId);
    if (building === undefined) continue;
    const tier = tierById.get(building.currentTierId);
    if (tier === undefined) continue;

    if (
      change.toState === "suspended" ||
      change.toState === "auto_deconstructed"
    ) {
      for (const effect of tier.effectsJson) {
        if (effect.type !== "population_cap_increase") continue;
        pendingPopCapBySettlement.set(
          building.settlementId,
          Math.max(
            0,
            (pendingPopCapBySettlement.get(building.settlementId) ?? 0) -
              effect.amount,
          ),
        );
      }
    } else if (change.toState === "active") {
      // Building recovered from suspension — restore its pop cap contribution.
      for (const effect of tier.effectsJson) {
        if (effect.type !== "population_cap_increase") continue;
        pendingPopCapBySettlement.set(
          building.settlementId,
          (pendingPopCapBySettlement.get(building.settlementId) ?? 0) +
            effect.amount,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 5 — Passive Effects
  // -------------------------------------------------------------------------

  const p5 = phasePassiveEffects(context);
  applyDeltas(p5.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 6 — Trade Routes
  // -------------------------------------------------------------------------

  const p6 = phaseTradeRoutes(context);
  applyDeltas(p6.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 7 — Managed Populations
  // -------------------------------------------------------------------------

  const p7 = phaseManagedPopulations(context);
  applyDeltas(p7.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 8 — Citizen Consumption
  // -------------------------------------------------------------------------

  const p8 = phaseCitizenConsumption(context);
  applyDeltas(p8.stockpileDeltas);

  // Propagate phase-8 deaths into shared state so downstream phases (10+) see
  // starvation victims as already dead when computing alive counts.
  for (const d of p8.citizenDeaths) {
    pendingDeaths.add(d.citizenId);
  }

  // -------------------------------------------------------------------------
  // Phase 9 — Partnerships (receives starvation deaths from phase 8)
  // -------------------------------------------------------------------------

  const p9 = phasePartnerships(context, p8.citizenDeaths);

  // -------------------------------------------------------------------------
  // Phase 10 — Homelessness
  // -------------------------------------------------------------------------

  const p10 = phaseHomelessness(context);

  // -------------------------------------------------------------------------
  // Phase 11 — Events
  // -------------------------------------------------------------------------

  const p11 = phaseEvents(context);

  // -------------------------------------------------------------------------
  // Phase 12 — Stockpile Clamp (mutates pendingStockpiles in place)
  // -------------------------------------------------------------------------

  // Structured (settlementId, resourceId) index threaded to the clamp phase so
  // it can read fields directly rather than parsing composite key strings.
  const stockpileKeyIndex = new Map<
    string,
    { readonly settlementId: string; readonly resourceId: string }
  >();
  for (const sp of input.stockpiles) {
    stockpileKeyIndex.set(`${sp.settlementId}:${sp.resourceId}`, {
      settlementId: sp.settlementId,
      resourceId: sp.resourceId,
    });
  }

  const p12 = phaseStockpileClamp(
    context,
    pendingStockpiles,
    effectiveStorageCaps,
    stockpileKeyIndex,
  );

  // -------------------------------------------------------------------------
  // Phase 13 — Logs and Snapshots
  // -------------------------------------------------------------------------

  const allDeaths = [...p8.citizenDeaths, ...p10.citizenDeaths];

  // Classify deltas for the snapshot builder.
  // productionDeltas: positive deltas from production phases.
  // consumptionDeltas: negative deltas from consumption phases.
  // tradeRouteDeltas: all deltas from phaseTradeRoutes (split internally by builder).
  //
  // Phase 12 (stockpileClamp) deltas are included here so the snapshot balance
  // equation holds: quantityAfter = quantityBefore + produced + tradeIn - consumed - tradeOut.
  // A positive clamp delta (negative stockpile raised to 0) joins production;
  // a negative clamp delta (over-cap stockpile lowered) joins consumption.
  const productionDeltas: StockpileDelta[] = [
    ...p1.stockpileDeltas.filter((d) => d.delta > 0),
    ...p2.stockpileDeltas.filter((d) => d.delta > 0),
    ...p5.stockpileDeltas,
    ...p7.stockpileDeltas.filter((d) => d.delta > 0),
    ...p12.stockpileDeltas.filter((d) => d.delta > 0),
  ];
  const consumptionDeltas: StockpileDelta[] = [
    ...p1.stockpileDeltas.filter((d) => d.delta < 0),
    ...p2.stockpileDeltas.filter((d) => d.delta < 0),
    ...p3.stockpileDeltas,
    ...p4.stockpileDeltas,
    ...p7.stockpileDeltas.filter((d) => d.delta < 0),
    ...p8.stockpileDeltas,
    ...p12.stockpileDeltas.filter((d) => d.delta < 0),
  ];

  const p13 = phaseLogsAndSnapshots(context, {
    allDeaths,
    buildingStateChanges: p4.buildingStateChanges,
    citizenBirths: p9.citizenBirths,
    consumptionDeltas,
    depositUpdates: p2.depositUpdates,
    managedPopulationUpdates: p7.managedPopulationUpdates,
    partnershipChanges: p9.partnershipChanges,
    pendingStockpiles,
    productionDeltas,
    tradeRouteDeltas: p6.stockpileDeltas,
    tradeRouteOutcomes: p6.tradeRouteOutcomes,
  });

  // -------------------------------------------------------------------------
  // Assemble final result
  // -------------------------------------------------------------------------

  const logEntries: SimulationLogEntry[] = [
    ...p1.logs,
    ...p2.logs,
    ...p3.logs,
    ...p4.logs,
    ...p5.logs,
    ...p6.logs,
    ...p7.logs,
    ...p8.logs,
    ...p9.logs,
    ...p10.logs,
    ...p11.logs,
    ...p12.logs,
    ...p13.logs,
  ];

  const notifications: SimulationNotification[] = [
    ...p2.notifications,
    ...p3.notifications,
    ...p4.notifications,
    ...p7.notifications,
    ...p8.notifications,
    ...p9.notifications,
    ...p10.notifications,
    ...p11.notifications,
  ];

  const stockpileDeltas: StockpileDelta[] = [
    ...p1.stockpileDeltas,
    ...p2.stockpileDeltas,
    ...p3.stockpileDeltas,
    ...p4.stockpileDeltas,
    ...p5.stockpileDeltas,
    ...p6.stockpileDeltas,
    ...p7.stockpileDeltas,
    ...p8.stockpileDeltas,
    ...p12.stockpileDeltas,
  ];

  return {
    assignmentClears: [
      ...p2.assignmentClears,
      ...p3.assignmentClears,
      ...p7.assignmentClears,
    ],
    buildingStateChanges: p4.buildingStateChanges,
    buildingsCreated: p3.buildingsCreated,
    citizenBirths: p9.citizenBirths,
    citizenDeaths: allDeaths,
    citizenPatches: p9.citizenPatches,
    constructionUpdates: p3.constructionUpdates,
    depositUpdates: p2.depositUpdates,
    logEntries,
    managedPopulationUpdates: p7.managedPopulationUpdates,
    notifications,
    partnershipChanges: p9.partnershipChanges,
    readinessSummary: computeReadinessSummary(input),
    resourceSnapshots: p13.resourceSnapshots,
    settlementSnapshots: p13.settlementSnapshots,
    stockpileDeltas,
    tradeRouteOutcomes: p6.tradeRouteOutcomes,
  };
}

function computeReadinessSummary(
  input: SimulationInputState,
): ReadinessSummary {
  const totalSettlementCount = input.settlements.length;
  const readySettlementCount = input.settlements.filter(
    (s) => (s.isReadyCurrentTurn ?? false) || (s.autoReadyEnabled ?? false),
  ).length;
  const notReadySettlementCount = totalSettlementCount - readySettlementCount;
  const readyPercentage =
    totalSettlementCount === 0
      ? 0
      : (readySettlementCount / totalSettlementCount) * 100;
  return {
    notReadySettlementCount,
    readyPercentage,
    readySettlementCount,
    totalSettlementCount,
  };
}
