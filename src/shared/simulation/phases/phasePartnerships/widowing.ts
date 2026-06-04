// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  CitizenDeath,
  PartnershipChange,
  SimCitizen,
  SimPartnership,
  SimulationLogEntry,
  SimulationNotification,
} from "../../simulationTypes.ts";

export type WidowingResult = {
  readonly inMourningCitizenIds: Set<string>;
  readonly logs: SimulationLogEntry[];
  readonly newlyWidowedPartnershipIds: Set<string>;
  readonly notifications: SimulationNotification[];
  readonly pairedCitizenIds: Set<string>;
  readonly partnershipChanges: PartnershipChange[];
  readonly priorDeadIds: Set<string>;
};

export function applyWidowing(
  partnerships: readonly SimPartnership[],
  priorDeaths: readonly CitizenDeath[],
  citizenById: Map<string, SimCitizen>,
  mourningPeriodTurns: number,
  turnNumber: number,
): WidowingResult {
  const priorDeadIds = new Set(priorDeaths.map((d) => d.citizenId));
  const newlyWidowedSurvivorIds = new Set<string>();
  const partnershipChanges: PartnershipChange[] = [];
  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];

  for (const partnership of partnerships) {
    if (partnership.status !== "active") continue;
    const aDied = priorDeadIds.has(partnership.citizenAId);
    const bDied = priorDeadIds.has(partnership.citizenBId);
    if (!aDied && !bDied) continue;

    partnershipChanges.push({
      partnershipId: partnership.id,
      reason: "partner_died",
      toStatus: "widowed",
      type: "status_changed",
    });

    const survivorId = aDied ? partnership.citizenBId : partnership.citizenAId;
    const survivorAlive = !priorDeadIds.has(survivorId);
    const survivor = citizenById.get(survivorId);
    const survivorSettlementId =
      survivor !== undefined ? survivor.settlementId : null;

    logs.push({
      category: "partnership.widowed",
      payload: {
        partnershipId: partnership.id,
        survivingCitizenId: survivorId,
      },
      phase: "partnerships",
      settlementId: survivorSettlementId ?? undefined,
    });

    if (survivorAlive) {
      newlyWidowedSurvivorIds.add(survivorId);
      notifications.push({
        messageText: `A citizen lost their partner this turn.`,
        notificationType: "partnership.widowed",
        scope: "settlement",
        settlementId: survivorSettlementId ?? undefined,
      });
    }
  }

  const newlyWidowedPartnershipIds = new Set(
    partnershipChanges
      .filter(
        (c): c is Extract<PartnershipChange, { type: "status_changed" }> =>
          c.type === "status_changed",
      )
      .map((c) => c.partnershipId),
  );

  const pairedCitizenIds = new Set<string>();
  for (const p of partnerships) {
    if (p.status !== "active") continue;
    if (newlyWidowedPartnershipIds.has(p.id)) continue;
    pairedCitizenIds.add(p.citizenAId);
    pairedCitizenIds.add(p.citizenBId);
  }

  const inMourningCitizenIds = new Set<string>();
  for (const p of partnerships) {
    if (p.status !== "widowed" || p.endedOnTurnNumber === null) continue;
    if (turnNumber - p.endedOnTurnNumber <= mourningPeriodTurns) {
      inMourningCitizenIds.add(p.citizenAId);
      inMourningCitizenIds.add(p.citizenBId);
    }
  }
  for (const id of newlyWidowedSurvivorIds) {
    inMourningCitizenIds.add(id);
  }

  return {
    inMourningCitizenIds,
    logs,
    newlyWidowedPartnershipIds,
    notifications,
    pairedCitizenIds,
    partnershipChanges,
    priorDeadIds,
  };
}
