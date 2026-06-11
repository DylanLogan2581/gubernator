// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { pickChildNamesetId } from "./childNameset.ts";

import type { SeededRng } from "../../seededRng.ts";
import type {
  CitizenBirth,
  NpcFlavorConfig,
  SimCitizen,
  SimNamingConfig,
  SimPartnership,
  SimSettlement,
  SimulationLogEntry,
} from "../../simulationTypes.ts";

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

function generateBirthName(
  rng: SeededRng,
  namingConfig: SimNamingConfig | null | undefined,
  sex: string,
  parentA: SimCitizen,
  parentB: SimCitizen,
): { givenName: string; surname: string | null } {
  if (namingConfig === null || namingConfig === undefined) {
    return { givenName: "", surname: null };
  }

  const normalized = sex.trim().toLowerCase();
  const pool = normalized === "male"
    ? namingConfig.male_given_names
    : normalized === "female"
    ? namingConfig.female_given_names
    : [
      ...namingConfig.male_given_names,
      ...namingConfig.female_given_names,
    ];

  if (pool.length === 0) return { givenName: "", surname: null };

  const givenName = pool[Math.floor(rng() * pool.length)] ?? "";

  let surname: string | null;
  switch (namingConfig.convention) {
    case "pool":
      surname = pickFromPool(rng, namingConfig.surnames);
      break;
    case "patronymic": {
      const [father, other] = parentsBySex(parentA, parentB, "male");
      surname = nonEmpty(father?.givenName) ?? nonEmpty(other?.givenName);
      break;
    }
    case "matronymic": {
      const [mother, other] = parentsBySex(parentA, parentB, "female");
      surname = nonEmpty(mother?.givenName) ?? nonEmpty(other?.givenName);
      break;
    }
    case "family-name": {
      const first = rng() < 0.5 ? parentA : parentB;
      const second = first === parentA ? parentB : parentA;
      surname = nonEmpty(first.surname) ?? nonEmpty(second.surname);
      break;
    }
    default:
      surname = null;
  }

  return { givenName, surname };
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parentsBySex(
  parentA: SimCitizen,
  parentB: SimCitizen,
  sex: "male" | "female",
): [SimCitizen | undefined, SimCitizen | undefined] {
  if (parentA.sex === sex) return [parentA, parentB];
  if (parentB.sex === sex) return [parentB, parentA];
  return [undefined, parentA];
}

export type FertilityResult = {
  readonly citizenBirths: CitizenBirth[];
  readonly logs: SimulationLogEntry[];
};

export function applyFertilityForSettlement(
  settlement: SimSettlement,
  activePartnerships: readonly SimPartnership[],
  citizenById: Map<string, SimCitizen>,
  stockpileQty: Map<string, number>,
  popCapBySettlement: Map<string, number>,
  aliveCountBySettlement: Map<string, number>,
  systemResourceIds: { foodId: string; freshWaterId: string },
  fertilityChance: number,
  minimumPartnershipAgeTurns: number,
  maximumFertilityAgeTurns: number | null,
  npcFlavorConfig: NpcFlavorConfig | null | undefined,
  namesetConfigById: Readonly<Record<string, SimNamingConfig>>,
  fallbackNamesetId: string | null,
  turnNumber: number,
  rng: SeededRng,
): FertilityResult {
  const sid = settlement.id;
  const foodStock = stockpileQty.get(`${sid}:${systemResourceIds.foodId}`) ?? 0;
  const waterStock = stockpileQty.get(`${sid}:${systemResourceIds.freshWaterId}`) ?? 0;
  const popCap = popCapBySettlement.get(sid) ?? 0;
  let currentAliveCount = aliveCountBySettlement.get(sid) ?? 0;

  const citizenBirths: CitizenBirth[] = [];
  const logs: SimulationLogEntry[] = [];

  for (const partnership of activePartnerships) {
    const citizenA = citizenById.get(partnership.citizenAId);
    const citizenB = citizenById.get(partnership.citizenBId);
    if (citizenA === undefined || citizenB === undefined) continue;
    if (citizenA.settlementId !== sid || citizenB.settlementId !== sid) {
      continue;
    }
    if (citizenA.status !== "alive" || citizenB.status !== "alive") continue;

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
      if (ageA > maximumFertilityAgeTurns || ageB > maximumFertilityAgeTurns) {
        continue;
      }
    }

    if (currentAliveCount >= popCap) continue;
    if (foodStock <= 0 || waterStock <= 0) continue;
    if (rng() >= fertilityChance) continue;

    const sex = rng() < 0.5 ? "male" : "female";
    const flavor = pickNpcFlavor(rng, npcFlavorConfig);
    const childNamesetId = pickChildNamesetId(
      rng,
      citizenA.namesetId,
      citizenB.namesetId,
      (namesetId) => namesetConfigById[namesetId] !== undefined,
      fallbackNamesetId,
    );
    const namingConfig = childNamesetId !== null ? namesetConfigById[childNamesetId] : null;
    const { givenName, surname } = generateBirthName(
      rng,
      namingConfig,
      sex,
      citizenA,
      citizenB,
    );

    citizenBirths.push({
      ...flavor,
      givenName,
      namesetId: childNamesetId,
      parentACitizenId: partnership.citizenAId,
      parentBCitizenId: partnership.citizenBId,
      sex,
      settlementId: sid,
      surname,
    });
    logs.push({
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

  return { citizenBirths, logs };
}
