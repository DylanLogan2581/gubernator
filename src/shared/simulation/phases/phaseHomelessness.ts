// Phase: homelessness — kills excess NPCs when alive NPC count > population cap.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { compareById } from "../sortUtils.ts";

import type {
  CitizenDeath,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseHomelessnessOutput = {
  readonly citizenDeaths: readonly CitizenDeath[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

export function phaseHomelessness(
  context: SimulationContext,
): PhaseHomelessnessOutput {
  const {
    buildingTiers,
    citizens,
    populationRules,
    settlementBuildings,
    settlements,
  } = context.input;

  const { homelessnessDecliningRate } = populationRules;

  // Population cap per settlement from active buildings only.
  const tierById = new Map(buildingTiers.map((t) => [t.id, t]));
  const popCapBySettlement = new Map<string, number>();
  for (const building of settlementBuildings) {
    if (building.state !== "active") continue;
    const tier = tierById.get(building.currentTierId);
    if (tier === undefined) continue;
    for (const effect of tier.effectsJson) {
      if (effect.type !== "population_cap_increase") continue;
      popCapBySettlement.set(
        building.settlementId,
        (popCapBySettlement.get(building.settlementId) ?? 0) + effect.amount,
      );
    }
  }

  const allDeaths: CitizenDeath[] = [];
  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];

  for (const settlement of settlements) {
    const sid = settlement.id;
    const cap = popCapBySettlement.get(sid) ?? 0;

    const aliveNpcs = citizens.filter(
      (c) =>
        c.status === "alive" &&
        c.settlementId === sid &&
        c.citizenType === "npc" &&
        !context.shared.pendingDeaths.has(c.id),
    );
    const aliveNpcCount = aliveNpcs.length;

    const overage = Math.max(0, aliveNpcCount - cap);
    if (overage === 0) continue;

    const homelessDeaths = Math.min(
      overage,
      Math.ceil(overage * homelessnessDecliningRate),
    );
    if (homelessDeaths === 0) continue;

    // Deterministic: eldest (lowest bornOnTurnNumber) first, then citizenId ascending.
    // null bornOnTurnNumber sorts before any real turn (treated as -Infinity).
    const sorted = aliveNpcs.slice().sort((a, b) => {
      const aTurn = a.bornOnTurnNumber ?? -Infinity;
      const bTurn = b.bornOnTurnNumber ?? -Infinity;
      if (aTurn !== bTurn) return aTurn - bTurn;
      return compareById(a, b);
    });

    const toKill = sorted.slice(0, homelessDeaths);
    const deathDetail = `cap: ${cap}, alive: ${aliveNpcCount}`;

    for (const citizen of toKill) {
      allDeaths.push({
        category: "homeless",
        citizenId: citizen.id,
        detail: deathDetail,
      });
      allLogs.push({
        category: "citizen.died_homeless",
        citizenId: citizen.id,
        payload: { deathDetail },
        phase: "homelessness",
        settlementId: sid,
      });
    }

    allNotifications.push({
      messageText: `${homelessDeaths} citizen(s) died from homelessness in ${settlement.name}.`,
      notificationType: "settlement.homelessness_occurred",
      scope: "settlement",
      settlementId: sid,
    });
  }

  return {
    citizenDeaths: allDeaths,
    logs: allLogs,
    notifications: allNotifications,
  };
}
