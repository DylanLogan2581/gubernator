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

/**
 * Resolves the ancestor set of a citizen, memoized per citizen id.
 *
 * Built once per phase so partner matching does one BFS per citizen instead of
 * one per candidate pair. The result is purely a function of `citizenById` and
 * `depth`, so memoization cannot change outcomes.
 */
export type AncestorSetLookup = (citizenId: string) => Set<string>;

export function createAncestorSetLookup(
  citizenById: Map<string, SimCitizen>,
  depth: number,
): AncestorSetLookup {
  const cache = new Map<string, Set<string>>();
  return (citizenId) => {
    const cached = cache.get(citizenId);
    if (cached !== undefined) return cached;
    const built = buildAncestorSet(citizenId, depth, citizenById);
    cache.set(citizenId, built);
    return built;
  };
}

function hasCloseKinship(
  aId: string,
  bId: string,
  ancestorSetOf: AncestorSetLookup,
): boolean {
  const aAncestors = ancestorSetOf(aId);
  const bAncestors = ancestorSetOf(bId);
  // At depth 0 each set is just {self}, so distinct citizens never intersect —
  // matching the previous explicit `depth === 0 → false` short-circuit.
  const [small, large] =
    aAncestors.size <= bAncestors.size
      ? [aAncestors, bAncestors]
      : [bAncestors, aAncestors];
  for (const id of small) {
    if (large.has(id)) return true;
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
  settlementCitizens: readonly SimCitizen[],
  priorDeadIds: Set<string>,
  pairedCitizenIds: Set<string>,
  inMourningCitizenIds: Set<string>,
  turnNumber: number,
  minimumPartnershipAgeTurns: number,
  partnershipSeekChance: number,
  ancestorSetOf: AncestorSetLookup,
  rng: SeededRng,
): FormationResult {
  const sid = settlement.id;

  // `settlementCitizens` is the settlement's slice of the per-turn citizen
  // index, so the candidate pool is bounded by settlement size instead of
  // rescanning every citizen in the world once per settlement.
  const eligible = settlementCitizens.filter((c) => {
    if (c.status !== "alive") return false;
    if (priorDeadIds.has(c.id)) return false;
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

  if (seekingMales.length === 0 || seekingFemales.length === 0) {
    return { logs, notifications, partnershipChanges };
  }

  for (const male of seekingMales) {
    if (newlyPaired.has(male.id)) continue;
    for (const female of seekingFemales) {
      if (newlyPaired.has(female.id)) continue;
      if (hasCloseKinship(male.id, female.id, ancestorSetOf)) continue;

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
