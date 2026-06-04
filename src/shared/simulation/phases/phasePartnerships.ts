// Phase: partnerships — born_on_turn_number backfill, partnership formation,
// widowing from prior-phase deaths, and fertility rolls.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { createSeededRng } from "../seededRng.ts";

import type { SeededRng } from "../seededRng.ts";
import type {
  CitizenBirth,
  CitizenDeath,
  CitizenPatch,
  NpcFlavorConfig,
  PartnershipChange,
  SimCitizen,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhasePartnershipsOutput = {
  readonly citizenBirths: readonly CitizenBirth[];
  readonly citizenPatches: readonly CitizenPatch[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly partnershipChanges: readonly PartnershipChange[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

function pickFromPool(rng: SeededRng, pool: readonly string[]): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)] ?? null;
}

function pickNpcFlavor(
  rng: SeededRng,
  config: NpcFlavorConfig | null | undefined,
): {
  npcFlaw: string | null;
  npcGoal: string | null;
  npcSecretContradiction: string | null;
  npcTrait1: string | null;
  npcTrait2: string | null;
} {
  if (config === null || config === undefined) {
    return {
      npcFlaw: null,
      npcGoal: null,
      npcSecretContradiction: null,
      npcTrait1: null,
      npcTrait2: null,
    };
  }
  return {
    npcFlaw: pickFromPool(rng, config.flaws),
    npcGoal: pickFromPool(rng, config.goals),
    npcSecretContradiction: pickFromPool(rng, config.contradictions),
    npcTrait1: pickFromPool(rng, config.traits),
    npcTrait2: pickFromPool(rng, config.traits),
  };
}

// ---------------------------------------------------------------------------
// Phase entry point
// ---------------------------------------------------------------------------

export function phasePartnerships(
  context: SimulationContext,
  priorDeaths: readonly CitizenDeath[] = [],
): PhasePartnershipsOutput {
  const {
    citizens: inputCitizens,
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

  const allLogs: SimulationLogEntry[] = [];
  const allNotifications: SimulationNotification[] = [];
  const allPartnershipChanges: PartnershipChange[] = [];
  const allCitizenBirths: CitizenBirth[] = [];
  const allCitizenPatches: CitizenPatch[] = [];

  // --- Pre-pass: backfill born_on_turn_number for admin-seeded citizens ---
  const citizenById = new Map(inputCitizens.map((c) => [c.id, c]));

  for (const citizen of inputCitizens) {
    if (citizen.bornOnTurnNumber === null) {
      const backfilledTurn = turnNumber - minimumPartnershipAgeTurns;
      allCitizenPatches.push({
        bornOnTurnNumber: backfilledTurn,
        citizenId: citizen.id,
      });
      citizenById.set(citizen.id, {
        ...citizen,
        bornOnTurnNumber: backfilledTurn,
      });
    }
  }

  // --- Widen active partnerships whose partner died in a prior phase this turn ---
  const priorDeadIds = new Set(priorDeaths.map((d) => d.citizenId));
  const newlyWidowedSurvivorIds = new Set<string>();

  for (const partnership of partnerships) {
    if (partnership.status !== "active") continue;
    const aDied = priorDeadIds.has(partnership.citizenAId);
    const bDied = priorDeadIds.has(partnership.citizenBId);
    if (!aDied && !bDied) continue;

    allPartnershipChanges.push({
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
    allLogs.push({
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
      allNotifications.push({
        messageText: `A citizen lost their partner this turn.`,
        notificationType: "partnership.widowed",
        scope: "settlement",
        settlementId: survivorSettlementId ?? undefined,
      });
    }
  }

  // --- Build eligibility lookup sets ---

  // Track IDs of partnerships widowed by prior deaths (so they're excluded below)
  const newlyWidowedPartnershipIds = new Set(
    allPartnershipChanges
      .filter(
        (c): c is Extract<PartnershipChange, { type: "status_changed" }> =>
          c.type === "status_changed",
      )
      .map((c) => c.partnershipId),
  );

  // Citizens currently in active partnerships
  const pairedCitizenIds = new Set<string>();
  for (const p of partnerships) {
    if (p.status !== "active") continue;
    if (newlyWidowedPartnershipIds.has(p.id)) continue;
    pairedCitizenIds.add(p.citizenAId);
    pairedCitizenIds.add(p.citizenBId);
  }

  // Citizens in mourning from prior widowed partnerships
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

  // --- Population caps: read from shared state (updated by phase 4) ---
  // This ensures buildings suspended or auto-deconstructed in phase 4 do not
  // contribute to the fertility cap check.
  const popCapBySettlement = context.shared.pendingPopCapBySettlement;

  const aliveCountBySettlement = new Map<string, number>();
  for (const citizen of citizenById.values()) {
    if (citizen.status !== "alive" || citizen.settlementId === null) continue;
    aliveCountBySettlement.set(
      citizen.settlementId,
      (aliveCountBySettlement.get(citizen.settlementId) ?? 0) + 1,
    );
  }

  // --- Stockpile lookup for fertility food/water checks ---
  // Read post-phase-8 quantities so citizen consumption is reflected.
  const stockpileQty = new Map(context.shared.pendingStockpiles);

  // Existing active partnerships (not newly widowed) used for fertility
  const activeInputPartnerships = partnerships.filter(
    (p) => p.status === "active" && !newlyWidowedPartnershipIds.has(p.id),
  );

  // --- Per-settlement processing ---
  for (const settlement of settlements) {
    const sid = settlement.id;

    // Eligible for partnership formation: alive, not dying this turn, unpaired,
    // of age, not in mourning
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

    // Deterministic sort before RNG rolls
    eligible.sort((a, b) => (a.id < b.id ? -1 : 1));

    // Roll seek chance per citizen
    const seekingMales: SimCitizen[] = [];
    const seekingFemales: SimCitizen[] = [];
    for (const citizen of eligible) {
      if (rng() < partnershipSeekChance) {
        if (citizen.sex === "male") seekingMales.push(citizen);
        else if (citizen.sex === "female") seekingFemales.push(citizen);
      }
    }

    // Pair each seeking male with the first kinship-compatible seeking female
    const newlyPaired = new Set<string>();
    for (const male of seekingMales) {
      if (newlyPaired.has(male.id)) continue;
      for (const female of seekingFemales) {
        if (newlyPaired.has(female.id)) continue;
        if (
          hasCloseKinship(
            male.id,
            female.id,
            incestPreventionDepth,
            citizenById,
          )
        ) {
          continue;
        }

        allPartnershipChanges.push({
          citizenAId: male.id,
          citizenBId: female.id,
          type: "formed",
        });
        allLogs.push({
          category: "partnership.formed",
          payload: {
            citizenAId: male.id,
            citizenBId: female.id,
          },
          phase: "partnerships",
          settlementId: sid,
        });
        allNotifications.push({
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

    // --- Fertility for existing active partnerships in this settlement ---
    const foodStock =
      stockpileQty.get(`${sid}:${systemResourceIds.foodId}`) ?? 0;
    const waterStock =
      stockpileQty.get(`${sid}:${systemResourceIds.freshWaterId}`) ?? 0;
    const popCap = popCapBySettlement.get(sid) ?? 0;
    let currentAliveCount = aliveCountBySettlement.get(sid) ?? 0;

    for (const partnership of activeInputPartnerships) {
      const citizenA = citizenById.get(partnership.citizenAId);
      const citizenB = citizenById.get(partnership.citizenBId);
      if (citizenA === undefined || citizenB === undefined) continue;
      if (citizenA.settlementId !== sid || citizenB.settlementId !== sid) {
        continue;
      }
      if (citizenA.status !== "alive" || citizenB.status !== "alive") {
        continue;
      }

      const bornA = citizenA.bornOnTurnNumber;
      const bornB = citizenB.bornOnTurnNumber;
      if (bornA === null || bornB === null) continue;

      const ageA = turnNumber - bornA;
      const ageB = turnNumber - bornB;
      if (
        ageA < minimumPartnershipAgeTurns ||
        ageB < minimumPartnershipAgeTurns
      ) {
        continue;
      }
      if (maximumFertilityAgeTurns !== null) {
        if (
          ageA > maximumFertilityAgeTurns ||
          ageB > maximumFertilityAgeTurns
        ) {
          continue;
        }
      }

      if (currentAliveCount >= popCap) continue;
      if (foodStock <= 0 || waterStock <= 0) continue;

      if (rng() >= fertilityChance) continue;

      const sex = rng() < 0.5 ? "male" : "female";
      const flavor = pickNpcFlavor(rng, npcFlavorConfig);

      allCitizenBirths.push({
        ...flavor,
        parentACitizenId: partnership.citizenAId,
        parentBCitizenId: partnership.citizenBId,
        sex,
        settlementId: sid,
      });
      allLogs.push({
        category: "citizen.born",
        payload: {
          parentACitizenId: partnership.citizenAId,
          parentBCitizenId: partnership.citizenBId,
        },
        phase: "partnerships",
        settlementId: sid,
      });

      currentAliveCount++;
    }
  }

  return {
    citizenBirths: allCitizenBirths,
    citizenPatches: allCitizenPatches,
    logs: allLogs,
    notifications: allNotifications,
    partnershipChanges: allPartnershipChanges,
  };
}
