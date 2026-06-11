// Settlement snapshot builder — builds one SettlementSnapshot per settlement.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  BuildingStateChange,
  CitizenBirth,
  CitizenDeath,
  DepositUpdate,
  ManagedPopulationUpdate,
  PartnershipChange,
  SettlementSnapshot,
  SettlementSnapshotBuildingStateCounts,
  SettlementSnapshotManagedPopEntry,
  SettlementSnapshotTradeEntry,
  SettlementSnapshotWarnings,
  SimulationContext,
  TradeRouteOutcome,
} from "../simulationTypes.ts";

export type {
  SettlementSnapshot,
  SettlementSnapshotBuildingStateCounts,
  SettlementSnapshotManagedPopEntry,
  SettlementSnapshotTradeEntry,
  SettlementSnapshotWarnings,
} from "../simulationTypes.ts";

export type BuildSettlementSnapshotsParams = {
  readonly allDeaths: readonly CitizenDeath[];
  readonly buildingStateChanges: readonly BuildingStateChange[];
  readonly citizenBirths: readonly CitizenBirth[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly managedPopulationUpdates: readonly ManagedPopulationUpdate[];
  readonly partnershipChanges: readonly PartnershipChange[];
  readonly tradeRouteOutcomes: readonly TradeRouteOutcome[];
};

export function buildSettlementSnapshots(
  context: SimulationContext,
  params: BuildSettlementSnapshotsParams,
): readonly SettlementSnapshot[] {
  const {
    buildingTiers,
    citizens,
    constructionProjects,
    deposits,
    managedPopulations,
    settlementBuildings,
    settlements,
    tradeRoutes,
    turnNumber,
  } = context.input;

  const {
    allDeaths,
    buildingStateChanges,
    citizenBirths,
    depositUpdates,
    managedPopulationUpdates,
    partnershipChanges,
    tradeRouteOutcomes,
  } = params;

  // Index: citizenId → settlementId (for death attribution and partnership lookup)
  const citizenSettlementById = new Map<string, string | null>();
  const citizenTypeById = new Map<string, string>();
  for (const c of citizens) {
    citizenSettlementById.set(c.id, c.settlementId);
    citizenTypeById.set(c.id, c.citizenType);
  }

  // Final building states after applying state changes this turn
  const finalBuildingStateById = new Map<string, string>();
  for (const b of settlementBuildings) {
    finalBuildingStateById.set(b.id, b.state);
  }
  for (const change of buildingStateChanges) {
    finalBuildingStateById.set(change.settlementBuildingId, change.toState);
  }

  // Population cap per settlement from final active building states
  const tierById = new Map(buildingTiers.map((t) => [t.id, t]));
  const popCapBySettlement = new Map<string, number>();
  for (const b of settlementBuildings) {
    const finalState = finalBuildingStateById.get(b.id) ?? b.state;
    if (finalState !== "active") continue;
    const tier = tierById.get(b.currentTierId);
    if (tier === undefined) continue;
    for (const effect of tier.effectsJson) {
      if (effect.type !== "population_cap_increase") continue;
      popCapBySettlement.set(
        b.settlementId,
        (popCapBySettlement.get(b.settlementId) ?? 0) + effect.amount,
      );
    }
  }

  // Managed population end-of-turn counts (apply countDeltas from updates)
  const managedPopCountById = new Map<string, number>();
  for (const mp of managedPopulations) {
    managedPopCountById.set(mp.id, mp.currentCount);
  }
  for (const update of managedPopulationUpdates) {
    const cur = managedPopCountById.get(update.managedPopulationInstanceId) ?? 0;
    managedPopCountById.set(
      update.managedPopulationInstanceId,
      cur + update.countDelta,
    );
  }

  // Deposit depleted this turn: depositInstanceId → settlementId
  const depletedDepositIdsBySettlement = new Map<string, string[]>();
  const depositSettlementById = new Map(
    deposits.map((d) => [d.id, d.settlementId]),
  );
  for (const update of depositUpdates) {
    if (update.toStatus !== "depleted") continue;
    const sid = depositSettlementById.get(update.depositInstanceId);
    if (sid === undefined) continue;
    const list = depletedDepositIdsBySettlement.get(sid);
    if (list === undefined) {
      depletedDepositIdsBySettlement.set(sid, [update.depositInstanceId]);
    } else {
      list.push(update.depositInstanceId);
    }
  }

  // Trade route outcomes indexed by route ID
  const outcomeByRouteId = new Map<string, TradeRouteOutcome>();
  for (const outcome of tradeRouteOutcomes) {
    outcomeByRouteId.set(outcome.tradeRouteId, outcome);
  }

  // Paused construction projects per settlement
  const pausedProjectIdsBySettlement = new Map<string, string[]>();
  for (const proj of constructionProjects) {
    if (proj.status !== "paused") continue;
    const list = pausedProjectIdsBySettlement.get(proj.settlementId);
    if (list === undefined) {
      pausedProjectIdsBySettlement.set(proj.settlementId, [proj.id]);
    } else {
      list.push(proj.id);
    }
  }

  const snapshots: SettlementSnapshot[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;

    // --- Population counts ---
    const aliveInSettlement = citizens.filter(
      (c) => c.status === "alive" && c.settlementId === sid,
    );
    const initialAliveNpc = aliveInSettlement.filter(
      (c) => c.citizenType === "npc",
    ).length;
    const initialAlivePc = aliveInSettlement.filter(
      (c) => c.citizenType === "player_character",
    ).length;

    const deathsInSettlement = allDeaths.filter(
      (d) => citizenSettlementById.get(d.citizenId) === sid,
    );
    const deathCount = deathsInSettlement.length;
    const starvationDeathsCount = deathsInSettlement.filter(
      (d) => d.category === "starvation",
    ).length;
    const homelessDeathsCount = deathsInSettlement.filter(
      (d) => d.category === "homeless",
    ).length;
    const npcDeathCount = deathsInSettlement.filter(
      (d) => citizenTypeById.get(d.citizenId) === "npc",
    ).length;
    const pcDeathCount = deathsInSettlement.filter(
      (d) => citizenTypeById.get(d.citizenId) === "player_character",
    ).length;

    const birthsInSettlement = citizenBirths.filter(
      (b) => b.settlementId === sid,
    );
    const birthCount = birthsInSettlement.length;

    const aliveNpc = initialAliveNpc - npcDeathCount + birthCount;
    const alivePc = initialAlivePc - pcDeathCount;
    const aliveTotal = aliveNpc + alivePc;

    // --- Partnerships formed ---
    const partnershipsFormedCount = partnershipChanges.filter(
      (ch): ch is Extract<PartnershipChange, { type: "formed" }> =>
        ch.type === "formed" &&
        citizenSettlementById.get(ch.citizenAId) === sid,
    ).length;

    // --- Population cap ---
    const populationCap = popCapBySettlement.get(sid) ?? 0;

    // --- Building summary ---
    const buildingsInSettlement = settlementBuildings.filter(
      (b) => b.settlementId === sid,
    );
    let activeCount = 0;
    let autoDeconCount = 0;
    let manualDeconCount = 0;
    let suspendedCount = 0;
    for (const b of buildingsInSettlement) {
      const state = finalBuildingStateById.get(b.id) ?? b.state;
      if (state === "active") activeCount++;
      else if (state === "auto_deconstructed") autoDeconCount++;
      else if (state === "manually_deconstructed") manualDeconCount++;
      else if (state === "suspended") suspendedCount++;
    }
    const buildingSummary: SettlementSnapshotBuildingStateCounts = {
      active: activeCount,
      auto_deconstructed: autoDeconCount,
      manually_deconstructed: manualDeconCount,
      suspended: suspendedCount,
    };

    // --- Managed population summary ---
    const managedPopulationSummary: SettlementSnapshotManagedPopEntry[] = [];
    for (const mp of managedPopulations) {
      if (mp.settlementId !== sid) continue;
      managedPopulationSummary.push({
        currentCount: managedPopCountById.get(mp.id) ?? mp.currentCount,
        instanceId: mp.id,
      });
    }

    // --- Trade summary ---
    const tradeSummary: SettlementSnapshotTradeEntry[] = [];
    for (const route of tradeRoutes) {
      if (
        route.originSettlementId !== sid &&
        route.destinationSettlementId !== sid
      ) {
        continue;
      }
      const outcome = outcomeByRouteId.get(route.id);
      if (outcome === undefined) continue;
      tradeSummary.push({
        delivered: outcome.delivered,
        quantityTransferred: outcome.quantityTransferred,
        tradeRouteId: route.id,
      });
    }

    // --- Warnings ---
    const warnings: SettlementSnapshotWarnings = {
      depletedDepositIds: depletedDepositIdsBySettlement.get(sid) ?? [],
      pausedProjectIds: pausedProjectIdsBySettlement.get(sid) ?? [],
    };

    snapshots.push({
      aliveNpc,
      alivePc,
      aliveTotal,
      birthCount,
      buildingSummary,
      deathCount,
      homelessDeathsCount,
      managedPopulationSummary,
      partnershipsFormedCount,
      populationCap,
      settlementId: sid,
      starvationDeathsCount,
      tradeSummary,
      turnNumber,
      warnings,
    });
  }

  return snapshots;
}
