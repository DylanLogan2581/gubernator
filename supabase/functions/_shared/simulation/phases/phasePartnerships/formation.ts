// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { compareById } from "../../sortUtils.ts";

import type { SeededRng } from "../../seededRng.ts";
import type {
  PartnershipChange,
  SimCitizen,
  SimSettlement,
  SimulationLogEntry,
  SimulationNotification,
} from "../../simulationTypes.ts";

function buildAncestorSet(
  citizenId: string,
  depth: number,
  citizenById: Map<string, SimCitizen>,
): Set<string> {
  const result = new Set<string>();
  let frontier = new Set<string>([citizenId]);
  for (let gen = 0; gen <= depth; gen++) {
    for (const id of frontier) {
      result.add(id);
    }
    if (gen === depth) break;
    const next = new Set<string>();
    for (const id of frontier) {
      const c = citizenById.get(id);
      if (c === undefined) continue;
      if (c.parentACitizenId !== null) next.add(c.parentACitizenId);
      if (c.parentBCitizenId !== null) next.add(c.parentBCitizenId);
    }
    frontier = next;
  }
  return result;
}

function hasCloseKinship(
  aId: string,
  bId: string,
  depth: number,
  citizenById: Map<string, SimCitizen>,
): boolean {
  if (depth === 0) return false;
  const aAncestors = buildAncestorSet(aId, depth, citizenById);
  const bAncestors = buildAncestorSet(bId, depth, citizenById);
  for (const id of aAncestors) {
    if (bAncestors.has(id)) return true;
  }
  return false;
}

export type FormationResult = {
  readonly logs: SimulationLogEntry[];
  readonly notifications: SimulationNotification[];
  readonly partnershipChanges: PartnershipChange[];
};

export function applyFormationForSettlement(
  settlement: SimSettlement,
  citizenById: Map<string, SimCitizen>,
  priorDeadIds: Set<string>,
  pairedCitizenIds: Set<string>,
  inMourningCitizenIds: Set<string>,
  turnNumber: number,
  minimumPartnershipAgeTurns: number,
  partnershipSeekChance: number,
  incestPreventionDepth: number,
  rng: SeededRng,
): FormationResult {
  const sid = settlement.id;

  const eligible = Array.from(citizenById.values()).filter((c) => {
    if (c.status !== "alive") return false;
    if (priorDeadIds.has(c.id)) return false;
    if (c.settlementId !== sid) return false;
    if (pairedCitizenIds.has(c.id)) return false;
    if (inMourningCitizenIds.has(c.id)) return false;
    const born = c.bornOnTurnNumber;
    if (born === null) return false;
    return turnNumber - born >= minimumPartnershipAgeTurns;
  });

  eligible.sort(compareById);

  const seekingMales: SimCitizen[] = [];
  const seekingFemales: SimCitizen[] = [];
  for (const citizen of eligible) {
    if (rng() < partnershipSeekChance) {
      if (citizen.sex === "male") seekingMales.push(citizen);
      else if (citizen.sex === "female") seekingFemales.push(citizen);
    }
  }

  const partnershipChanges: PartnershipChange[] = [];
  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];
  const newlyPaired = new Set<string>();

  for (const male of seekingMales) {
    if (newlyPaired.has(male.id)) continue;
    for (const female of seekingFemales) {
      if (newlyPaired.has(female.id)) continue;
      if (
        hasCloseKinship(male.id, female.id, incestPreventionDepth, citizenById)
      ) {
        continue;
      }

      partnershipChanges.push({
        citizenAId: male.id,
        citizenBId: female.id,
        type: "formed",
      });
      logs.push({
        category: "partnership.formed",
        payload: { citizenAId: male.id, citizenBId: female.id },
        phase: "partnerships",
        settlementId: sid,
      });
      notifications.push({
        messageText: `A new partnership formed in ${settlement.name}.`,
        notificationType: "partnership.formed",
        scope: "settlement",
        settlementId: sid,
      });

      newlyPaired.add(male.id);
      newlyPaired.add(female.id);
      break;
    }
  }

  return { logs, notifications, partnershipChanges };
}
