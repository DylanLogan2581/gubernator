// Simulation orchestrator — runs all 13 phases in spec order and assembles
// the final SimulationResult.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { phaseBuildingUpkeep } from "./phases/phaseBuildingUpkeep.ts";
import { phaseCitizenConsumption } from "./phases/phaseCitizenConsumption.ts";
import { phaseConstruction } from "./phases/phaseConstruction.ts";
import { phaseDepositExtraction } from "./phases/phaseDepositExtraction.ts";
import { phaseEducation } from "./phases/phaseEducation.ts";
import { phaseEvents } from "./phases/phaseEvents.ts";
import { phaseHomelessness } from "./phases/phaseHomelessness.ts";
import { phaseLogsAndSnapshots } from "./phases/phaseLogsAndSnapshots.ts";
import { phaseManagedPopulations } from "./phases/phaseManagedPopulations.ts";
import { phaseMilitaryUpkeep } from "./phases/phaseMilitaryUpkeep.ts";
import { phaseNationalEconomy } from "./phases/phaseNationalEconomy.ts";
import { phasePartnerships } from "./phases/phasePartnerships/index.ts";
import { phasePassiveEffects } from "./phases/phasePassiveEffects.ts";
import { phaseResourceDecay } from "./phases/phaseResourceDecay.ts";
import { phaseStandardJobs } from "./phases/phaseStandardJobs.ts";
import { phaseStockpileClamp } from "./phases/phaseStockpileClamp.ts";
import { phaseSuccession } from "./phases/phaseSuccession.ts";
import { phaseTradeRoutes } from "./phases/phaseTradeRoutes.ts";
import { phaseTreaties, phaseTreatyMarriageNotes } from "./phases/phaseTreaties.ts";
import { SimulationRejectionError } from "./simulationTypes.ts";

import type {
  DisbandedUnit,
  ManagedPopulationUpdate,
  NationStockpileDelta,
  NationTurnSnapshot,
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
  _transitionId: string,
): SimulationResult {
  if (input.isWorldArchived === true) {
    throw new SimulationRejectionError(
      "world_archived",
      "Cannot run simulation on an archived world.",
    );
  }

  // -------------------------------------------------------------------------
  // Shared mutable state — initialized from input and updated after each phase.
  // -------------------------------------------------------------------------

  const pendingStockpiles = new Map<string, number>();
  for (const sp of input.stockpiles) {
    pendingStockpiles.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  const pendingNationStockpiles = new Map<string, number>();
  for (const sp of input.nationResourceStockpiles) {
    pendingNationStockpiles.set(`${sp.nationId}:${sp.resourceId}`, sp.quantity);
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

  const pendingEventMultipliers = new Map<
    string,
    {
      productionByJobId: Map<string, number>;
      productionByBuildingId: Map<string, number>;
      consumption: number;
      upkeep: number;
      upkeepByBlueprintId: Map<string, number>;
      upkeepByBuildingInstanceId: Map<string, number>;
    }
  >();

  const pendingManagedPopulationDeltas = new Map<string, number>();

  const pendingDepositDestroys = new Set<string>();

  const context: SimulationContext = {
    input,
    shared: {
      pendingDeaths,
      pendingEventMultipliers,
      pendingManagedPopulationDeltas,
      pendingPopCapBySettlement,
      pendingStockpiles,
      pendingDepositDestroys,
      pendingNationStockpiles,
    },
  };

  function applyDeltas(deltas: readonly StockpileDelta[]): void {
    for (const d of deltas) {
      const key = `${d.settlementId}:${d.resourceId}`;
      pendingStockpiles.set(key, (pendingStockpiles.get(key) ?? 0) + d.delta);
    }
  }

  function applyNationDeltas(deltas: readonly NationStockpileDelta[]): void {
    for (const d of deltas) {
      const key = `${d.nationId}:${d.resourceId}`;
      pendingNationStockpiles.set(key, (pendingNationStockpiles.get(key) ?? 0) + d.delta);
    }
  }

  // Merges phaseNationalEconomy's tax snapshots with phaseTreaties' tribute
  // snapshots into one row per nation — nation_turn_snapshots has a unique
  // (turn_transition_id, nation_id) constraint, so two separate entries for
  // the same nation would silently drop whichever inserts second.
  function mergeNationTurnSnapshots(
    snapshotLists: ReadonlyArray<readonly NationTurnSnapshot[]>,
  ): NationTurnSnapshot[] {
    const byNationId = new Map<string, NationTurnSnapshot>();
    for (const snapshots of snapshotLists) {
      for (const snapshot of snapshots) {
        const existing = byNationId.get(snapshot.nationId);
        byNationId.set(snapshot.nationId, {
          nationId: snapshot.nationId,
          taxCollectedByResource: {
            ...existing?.taxCollectedByResource,
            ...snapshot.taxCollectedByResource,
          },
          tributePaidByResource: {
            ...existing?.tributePaidByResource,
            ...snapshot.tributePaidByResource,
          },
          tributeReceivedByResource: {
            ...existing?.tributeReceivedByResource,
            ...snapshot.tributeReceivedByResource,
          },
        });
      }
    }
    return [...byNationId.values()];
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
  // Phase 4.5 — Education
  // -------------------------------------------------------------------------
  // #1104's issue text says "before construction", but that note was written
  // against a stale line-numbered draft of this pipeline. The concrete
  // acceptance criterion ("a building that went inactive this turn must
  // teach nothing this turn") requires seeing this-turn building state
  // changes, which only exist after phaseBuildingUpkeep (p4) runs — so
  // education runs here instead, after p4 and before Phase 5.

  const p4dot5 = phaseEducation(context, p4.buildingStateChanges);

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
  // Phase 6.5 — National Economy (tax collection in kind)
  // -------------------------------------------------------------------------
  // Tax base is gross production from jobs (p1) and deposits (p2) only, per
  // the spec — not passive effects or managed populations. Runs before
  // citizen consumption so consumption sees post-tax stockpiles.

  const nationalEconomyProductionDeltas: StockpileDelta[] = [
    ...p1.stockpileDeltas.filter((d) => d.delta > 0),
    ...p2.stockpileDeltas.filter((d) => d.delta > 0),
  ];
  const p6dot5 = phaseNationalEconomy(context, nationalEconomyProductionDeltas);
  applyDeltas(p6dot5.stockpileDeltas);
  applyNationDeltas(p6dot5.nationStockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 6.75 — Treaties: tribute + expiry (#1090)
  // -------------------------------------------------------------------------
  // Runs right after nation tax collection so tribute can spend from
  // freshly-taxed goods the same transition. Royal marriage death notes are
  // handled separately (phaseTreatyMarriageNotes, below) once this-turn
  // deaths from every mortality-causing phase are known.

  const p6dot75 = phaseTreaties(context);
  applyNationDeltas(p6dot75.nationStockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 7 — Managed Populations
  // -------------------------------------------------------------------------

  const p7 = phaseManagedPopulations(context);
  applyDeltas(p7.stockpileDeltas);

  // -------------------------------------------------------------------------
  // Phase 7.5 — Military Upkeep (#1110)
  // -------------------------------------------------------------------------
  // Runs after national economy (post-tax nation/settlement stockpiles) and
  // before citizen consumption, per the issue's ordering requirement.

  const p7dot5 = phaseMilitaryUpkeep(context);
  applyDeltas(p7dot5.stockpileDeltas);
  applyNationDeltas(p7dot5.nationStockpileDeltas);

  // -------------------------------------------------------------------------
  // Soldier residency (#1111): an enlisted soldier's effective settlement for
  // consumption is their army's stationed settlement, not their home
  // settlement (citizens.settlement_id is never mutated by enlistment or
  // stationing). A soldier who deserted this turn (phase 7.5, above) has
  // already returned to civilian life at their resolved settlement, so they
  // are excluded here and fall back to citizens.settlementId like everyone
  // else. Soldiers are always NPCs (recruit_soldiers restricts eligibility).
  // -------------------------------------------------------------------------

  const desertedSoldierIdsThisTurn = new Set(p7dot5.desertedSoldiers.map((d) => d.soldierId));
  const armyIdByUnitId = new Map(input.armyUnits.map((u) => [u.id, u.armyId]));
  const armyById = new Map(input.armies.map((a) => [a.id, a]));

  const effectiveSettlementIdByCitizenId = new Map<string, string>();
  const enlistedSoldierCitizenIds = new Set<string>();
  for (const soldier of input.unitSoldiers) {
    if (desertedSoldierIdsThisTurn.has(soldier.id)) continue;
    const armyId = armyIdByUnitId.get(soldier.unitId);
    const army = armyId !== undefined ? armyById.get(armyId) : undefined;
    if (army === undefined) continue;
    enlistedSoldierCitizenIds.add(soldier.citizenId);
    effectiveSettlementIdByCitizenId.set(soldier.citizenId, army.stationedSettlementId);
  }

  // -------------------------------------------------------------------------
  // Phase 8 — Citizen Consumption
  // -------------------------------------------------------------------------

  const p8 = phaseCitizenConsumption(context, effectiveSettlementIdByCitizenId);
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

  const p10 = phaseHomelessness(context, enlistedSoldierCitizenIds);

  // -------------------------------------------------------------------------
  // Phase 11 — Events
  // -------------------------------------------------------------------------

  const p11 = phaseEvents(context);

  // -------------------------------------------------------------------------
  // Phase 11.5 — Merge managed_population_change event deltas
  // -------------------------------------------------------------------------
  // phaseEvents (Phase 11) writes pendingManagedPopulationDeltas for
  // managed_population_change effects. Phase 7 (phaseManagedPopulations) ran
  // before Phase 11, so we merge the event deltas into the population updates
  // here, after Phase 11, clamping each population count at zero.

  const managedPopulationUpdates: ManagedPopulationUpdate[] = [
    ...p7.managedPopulationUpdates,
  ];
  if (pendingManagedPopulationDeltas.size > 0) {
    const popById = new Map(input.managedPopulations.map((p) => [p.id, p]));
    const idxByPopId = new Map(
      managedPopulationUpdates.map((u, i) => [u.managedPopulationInstanceId, i]),
    );

    for (const [popId, eventDelta] of pendingManagedPopulationDeltas) {
      const pop = popById.get(popId);
      if (pop === undefined || pop.status !== "active") continue;

      const idx = idxByPopId.get(popId);
      const priorDelta = idx !== undefined ? managedPopulationUpdates[idx].countDelta : 0;
      const countAfterP7 = pop.currentCount + priorDelta;

      // Clamp: event cannot drive the count below zero.
      const clampedDelta = Math.max(eventDelta, -countAfterP7);
      if (clampedDelta === 0) continue;

      const newCount = countAfterP7 + clampedDelta;
      const isExtinct = newCount <= 0;

      if (idx !== undefined) {
        const existing = managedPopulationUpdates[idx];
        managedPopulationUpdates[idx] = {
          ...existing,
          countDelta: existing.countDelta + clampedDelta,
          toStatus: isExtinct ? "extinct" : existing.toStatus,
        };
      } else {
        managedPopulationUpdates.push({
          countDelta: clampedDelta,
          managedPopulationInstanceId: popId,
          toStatus: isExtinct ? "extinct" : null,
        });
      }
    }
  }

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
  // Phase 12.5 — Resource Decay (mutates pendingStockpiles in place)
  // -------------------------------------------------------------------------

  // Index resources by ID for quick change mode/amount lookup.
  const resourcesByWorldId = new Map(
    input.resources.map((r) => [
      r.id,
      { changeAmount: r.changeAmount, changeMode: r.changeMode },
    ]),
  );

  const p12dot5 = phaseResourceDecay(
    pendingStockpiles,
    resourcesByWorldId,
    effectiveStorageCaps,
    stockpileKeyIndex,
  );

  // -------------------------------------------------------------------------
  // Phase 13 — Logs and Snapshots
  // -------------------------------------------------------------------------

  const allDeaths = [...p8.citizenDeaths, ...p10.citizenDeaths, ...p11.citizenDeaths];
  const allDeathIds = new Set(allDeaths.map((d) => d.citizenId));

  // -------------------------------------------------------------------------
  // Soldier death cascade (#1111): any death-causing phase above (8/10/11)
  // can kill an enlisted soldier. unit_soldiers rows for dead citizens must
  // be cascade-removed within this same transition; a unit that loses its
  // last soldier to death disbands, same as the desertion-driven disband
  // check in phaseMilitaryUpkeep.
  // -------------------------------------------------------------------------

  const deathCauseVerb: Record<string, string> = {
    event: "died",
    homeless: "died from homelessness",
    manual_admin: "died",
    starvation: "starved",
    unknown: "died",
  };

  const soldiersByUnitIdExcludingDeserted = new Map<string, typeof input.unitSoldiers[number][]>();
  for (const soldier of input.unitSoldiers) {
    if (desertedSoldierIdsThisTurn.has(soldier.id)) continue;
    const list = soldiersByUnitIdExcludingDeserted.get(soldier.unitId) ?? [];
    list.push(soldier);
    soldiersByUnitIdExcludingDeserted.set(soldier.unitId, list);
  }
  const deathByCitizenId = new Map(allDeaths.map((d) => [d.citizenId, d]));

  const deceasedSoldierIds: string[] = [];
  const soldierDeathCascadeLogs: SimulationLogEntry[] = [];
  const soldierDeathDisbandedUnits: DisbandedUnit[] = [];

  for (const [unitId, soldiers] of soldiersByUnitIdExcludingDeserted) {
    const deceased = soldiers.filter((s) => allDeathIds.has(s.citizenId));
    if (deceased.length === 0) continue;

    const armyId = armyIdByUnitId.get(unitId);
    const army = armyId !== undefined ? armyById.get(armyId) : undefined;
    if (army === undefined) continue;

    for (const soldier of deceased) {
      deceasedSoldierIds.push(soldier.id);
    }

    const verbCounts = new Map<string, number>();
    for (const soldier of deceased) {
      const verb = deathCauseVerb[deathByCitizenId.get(soldier.citizenId)?.category ?? "unknown"];
      verbCounts.set(verb, (verbCounts.get(verb) ?? 0) + 1);
    }
    const summary = [...verbCounts.entries()]
      .map(([verb, count]) => `${count} ${verb}`)
      .join(", ");

    // detail mirrors the issue's example phrasing, e.g.
    // "2 soldiers of the 1st Spears starved".
    soldierDeathCascadeLogs.push({
      category: "military.soldiers_died",
      nationId: army.nationId,
      payload: {
        armyId: army.id,
        deadSoldierCount: deceased.length,
        detail: `${deceased.length} soldier${
          deceased.length === 1 ? "" : "s"
        } of ${army.name} ${summary}.`,
        unitId,
      },
      phase: "soldierDeathCascade",
    });

    const remaining = soldiers.length - deceased.length;
    if (remaining === 0) {
      soldierDeathDisbandedUnits.push({ armyId: army.id, unitId });
      soldierDeathCascadeLogs.push({
        category: "military.unit_disbanded",
        nationId: army.nationId,
        payload: { armyId: army.id, unitId },
        phase: "soldierDeathCascade",
      });
    }
  }

  const pSuccession = phaseSuccession(context, allDeaths);
  const pTreatyMarriageNotes = phaseTreatyMarriageNotes(context, allDeaths);

  // Phase 10 (homelessness) runs after phase 9 (partnerships), so a citizen
  // can be selected for partnership formation and then die of homelessness in
  // the same turn. apply_turn_transition rejects "active" partnership entries
  // whose partners are already dead (guard added in epic-6). Drop any "formed"
  // change where either partner appears in allDeaths so the payload stays valid.
  const partnershipChanges = p9.partnershipChanges.filter((pc) => {
    if (pc.type !== "formed") return true;
    return !allDeathIds.has(pc.citizenAId) && !allDeathIds.has(pc.citizenBId);
  });

  // Filter partnership.formed logs and notifications to exclude pairs dropped
  // due to partner death. Build set of (A|B) pairs that are in final changes.
  const formedPartnerPairs = new Set<string>();
  for (const pc of partnershipChanges) {
    if (pc.type === "formed") {
      formedPartnerPairs.add(`${pc.citizenAId}|${pc.citizenBId}`);
    }
  }

  const filteredP9Logs = p9.logs.filter((log) => {
    if (log.category !== "partnership.formed") return true;
    const payload = log.payload as {
      citizenAId: string;
      citizenBId: string;
    };
    return formedPartnerPairs.has(
      `${payload.citizenAId}|${payload.citizenBId}`,
    );
  });

  // Determine which settlements have actual formations so we only keep
  // partnership.formed notifications for those settlements.
  const settlementWithFormations = new Set<string>();
  for (const pc of partnershipChanges) {
    if (pc.type === "formed") {
      const citizen = input.citizens.find((c) => c.id === pc.citizenAId);
      const settleId = citizen?.settlementId;
      if (settleId !== null && settleId !== undefined) {
        settlementWithFormations.add(settleId);
      }
    }
  }

  const filteredP9Notifications = p9.notifications.filter((notif) => {
    if (notif.notificationType !== "partnership.formed") return true;
    return (
      notif.settlementId !== null &&
      notif.settlementId !== undefined &&
      settlementWithFormations.has(notif.settlementId)
    );
  });

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
    ...p6dot5.stockpileDeltas,
    ...p7.stockpileDeltas.filter((d) => d.delta < 0),
    ...p7dot5.stockpileDeltas,
    ...p8.stockpileDeltas,
    ...p12.stockpileDeltas.filter((d) => d.delta < 0),
    ...p12dot5.stockpileDeltas,
  ];

  const allCitizenBirths = [...p9.citizenBirths, ...p11.citizenBirths];

  const p13 = phaseLogsAndSnapshots(context, {
    allDeaths,
    buildingStateChanges: [...p4.buildingStateChanges, ...p11.buildingStateChanges],
    citizenBirths: allCitizenBirths,
    consumptionDeltas,
    depositUpdates: p2.depositUpdates,
    educationSummaryBySettlementId: p4dot5.educationSummaryBySettlementId,
    managedPopulationUpdates,
    partnershipChanges,
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
    ...p4dot5.logs,
    ...p5.logs,
    ...p6.logs,
    ...p6dot5.logs,
    ...p6dot75.logs,
    ...p7.logs,
    ...p7dot5.logs,
    ...p8.logs,
    ...filteredP9Logs,
    ...p10.logs,
    ...p11.logs,
    ...p12.logs,
    ...p12dot5.logs,
    ...p13.logs,
    ...pSuccession.logs,
    ...pTreatyMarriageNotes.logs,
    ...soldierDeathCascadeLogs,
  ];

  const notifications: SimulationNotification[] = [
    ...p2.notifications,
    ...p3.notifications,
    ...p4.notifications,
    ...p4dot5.notifications,
    ...p6dot5.notifications,
    ...p7.notifications,
    ...p7dot5.notifications,
    ...p8.notifications,
    ...filteredP9Notifications,
    ...p10.notifications,
    ...p11.notifications,
    ...pSuccession.notifications,
  ];

  const stockpileDeltas: StockpileDelta[] = [
    ...p1.stockpileDeltas,
    ...p2.stockpileDeltas,
    ...p3.stockpileDeltas,
    ...p4.stockpileDeltas,
    ...p5.stockpileDeltas,
    ...p6.stockpileDeltas,
    ...p6dot5.stockpileDeltas,
    ...p7.stockpileDeltas,
    ...p7dot5.stockpileDeltas,
    ...p8.stockpileDeltas,
    ...p12.stockpileDeltas,
    ...p12dot5.stockpileDeltas,
  ];

  return {
    armyTurnSnapshots: p7dot5.armyTurnSnapshots,
    assignmentClears: [
      ...p2.assignmentClears,
      ...p3.assignmentClears,
      ...p7.assignmentClears,
      // Citizens who die in phase 8 (starvation) or phase 10 (homelessness)
      // must have their citizen_assignments rows deleted so job counts stay
      // accurate after the transition completes.
      ...allDeaths.map((d) => ({
        citizenId: d.citizenId,
        reason: "citizen_died",
      })),
    ],
    buildingStateChanges: [...p4.buildingStateChanges, ...p11.buildingStateChanges],
    buildingTierUpgrades: p3.buildingTierUpgrades,
    buildingsCreated: p3.buildingsCreated,
    citizenBirths: allCitizenBirths,
    citizenDeaths: allDeaths,
    citizenEducationPatches: p4dot5.citizenEducationPatches,
    citizenPatches: p9.citizenPatches,
    constructionUpdates: p3.constructionUpdates,
    depositUpdates: [...p2.depositUpdates, ...p11.depositUpdates],
    deceasedSoldierIds,
    desertedSoldiers: p7dot5.desertedSoldiers,
    disbandedUnits: [...p7dot5.disbandedUnits, ...soldierDeathDisbandedUnits],
    enrollmentGraduations: p4dot5.enrollmentGraduations,
    enrollmentProgressUpdates: p4dot5.enrollmentProgressUpdates,
    eventStatusPatches: p11.eventStatusPatches,
    logEntries,
    managedPopulationUpdates,
    nationCurrencySnapshots: p6dot5.nationCurrencySnapshots,
    nationCurrencyUpdates: p6dot5.nationCurrencyUpdates,
    nationStockpileDeltas: [
      ...p6dot5.nationStockpileDeltas,
      ...p6dot75.nationStockpileDeltas,
      ...p7dot5.nationStockpileDeltas,
    ],
    nationTurnSnapshots: mergeNationTurnSnapshots([
      p6dot5.nationTurnSnapshots,
      p6dot75.nationTurnSnapshots,
    ]),
    notifications,
    partnershipChanges,
    readinessSummary: computeReadinessSummary(input),
    resourceSnapshots: p13.resourceSnapshots,
    settlementSnapshots: p13.settlementSnapshots,
    stockpileDeltas,
    tradeRouteOutcomes: p6.tradeRouteOutcomes,
    treatyStatusChanges: p6dot75.treatyStatusChanges,
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
  const readyPercentage = totalSettlementCount === 0
    ? 0
    : (readySettlementCount / totalSettlementCount) * 100;
  return {
    notReadySettlementCount,
    readyPercentage,
    readySettlementCount,
    totalSettlementCount,
  };
}
