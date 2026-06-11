// Phase: partnerships — born_on_turn_number backfill, partnership formation,
// widowing from prior-phase deaths, and fertility rolls.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { createSeededRng } from "../../seededRng.ts";

import { applyBornOnTurnNumberBackfill } from "./backfill.ts";
import { applyFertilityForSettlement } from "./fertility.ts";
import { applyFormationForSettlement } from "./formation.ts";
import { applyWidowing } from "./widowing.ts";

import type {
  CitizenBirth,
  CitizenDeath,
  CitizenPatch,
  PartnershipChange,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../../simulationTypes.ts";

export type PhasePartnershipsOutput = {
  readonly citizenBirths: readonly CitizenBirth[];
  readonly citizenPatches: readonly CitizenPatch[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly partnershipChanges: readonly PartnershipChange[];
};

export function phasePartnerships(
  context: SimulationContext,
  priorDeaths: readonly CitizenDeath[] = [],
): PhasePartnershipsOutput {
  const {
    citizens: inputCitizens,
    fallbackNamesetIdBySettlementId,
    namesetConfigById,
    npcFlavorConfig,
    partnerships,
    populationRules,
    settlements,
    systemResourceIds,
    turnNumber,
    worldId,
  } = context.input;

  const {
    fertilityChance,
    incestPreventionDepth,
    maximumFertilityAgeTurns,
    minimumPartnershipAgeTurns,
    mourningPeriodTurns,
    partnershipSeekChance,
  } = populationRules;

  const rng = createSeededRng(`${worldId}:${turnNumber}:partnerships`);

  const { citizenById, citizenPatches } = applyBornOnTurnNumberBackfill(
    inputCitizens,
    turnNumber,
    minimumPartnershipAgeTurns,
  );

  const widowing = applyWidowing(
    partnerships,
    priorDeaths,
    citizenById,
    mourningPeriodTurns,
    turnNumber,
  );

  const activeInputPartnerships = partnerships.filter(
    (p) => p.status === "active" && !widowing.newlyWidowedPartnershipIds.has(p.id),
  );

  const popCapBySettlement = context.shared.pendingPopCapBySettlement;
  const stockpileQty = new Map(context.shared.pendingStockpiles);

  const aliveCountBySettlement = new Map<string, number>();
  for (const citizen of citizenById.values()) {
    if (citizen.status !== "alive" || citizen.settlementId === null) continue;
    aliveCountBySettlement.set(
      citizen.settlementId,
      (aliveCountBySettlement.get(citizen.settlementId) ?? 0) + 1,
    );
  }

  const allPartnershipChanges: PartnershipChange[] = [
    ...widowing.partnershipChanges,
  ];
  const allLogs: SimulationLogEntry[] = [...widowing.logs];
  const allNotifications: SimulationNotification[] = [
    ...widowing.notifications,
  ];
  const allCitizenBirths: CitizenBirth[] = [];

  for (const settlement of settlements) {
    const formation = applyFormationForSettlement(
      settlement,
      citizenById,
      widowing.priorDeadIds,
      widowing.pairedCitizenIds,
      widowing.inMourningCitizenIds,
      turnNumber,
      minimumPartnershipAgeTurns,
      partnershipSeekChance,
      incestPreventionDepth,
      rng,
    );
    allPartnershipChanges.push(...formation.partnershipChanges);
    allLogs.push(...formation.logs);
    allNotifications.push(...formation.notifications);

    const fertility = applyFertilityForSettlement(
      settlement,
      activeInputPartnerships,
      citizenById,
      stockpileQty,
      popCapBySettlement,
      aliveCountBySettlement,
      systemResourceIds,
      fertilityChance,
      minimumPartnershipAgeTurns,
      maximumFertilityAgeTurns,
      npcFlavorConfig,
      namesetConfigById ?? {},
      fallbackNamesetIdBySettlementId?.[settlement.id] ?? null,
      turnNumber,
      rng,
    );
    allCitizenBirths.push(...fertility.citizenBirths);
    allLogs.push(...fertility.logs);
  }

  return {
    citizenBirths: allCitizenBirths,
    citizenPatches,
    logs: allLogs,
    notifications: allNotifications,
    partnershipChanges: allPartnershipChanges,
  };
}
