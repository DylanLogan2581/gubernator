// Micro-benchmark: partnership matching with a per-pair ancestor BFS (before)
// versus a per-phase memoized ancestor lookup (after), on a dense settlement.
//
// Not part of the test suite — run with:
//   npx vitest bench supabase/functions/_shared/simulation/phases/phasePartnerships/formation.bench.ts

import { bench, describe } from "vitest";

import { createSeededRng } from "../../seededRng.ts";
import { compareById } from "../../sortUtils.ts";
import { makeSettlement } from "../testFixtures.ts";

import {
  applyFormationForSettlement,
  createAncestorSetLookup,
} from "./formation.ts";

import type { SimCitizen } from "../../simulationTypes.ts";

const DEPTH = 3;
const SEEK_CHANCE = 0.9;

const SETTLEMENT = makeSettlement({ id: "s1", name: "Denseville" });

/**
 * Dense settlement: a few large sibling groups, so most candidate pairs are
 * rejected as close kin and the matching loop actually runs quadratically —
 * the shape that made the per-pair BFS expensive.
 */
function makeDenseSettlement(families: number, children: number): SimCitizen[] {
  const citizens: SimCitizen[] = [];
  for (let family = 0; family < families; family++) {
    const fa = `p-a-${family}`;
    const fb = `p-b-${family}`;
    for (const [id, sex] of [
      [fa, "male"],
      [fb, "female"],
    ] as const) {
      citizens.push(makeCitizen(id, sex, null, null, "dead"));
    }
    for (let child = 0; child < children; child++) {
      citizens.push(
        makeCitizen(
          `c-${family}-${child}`,
          child % 2 === 0 ? "male" : "female",
          fa,
          fb,
          "alive",
        ),
      );
    }
  }
  return citizens;
}

function makeCitizen(
  id: string,
  sex: "male" | "female",
  parentA: string | null,
  parentB: string | null,
  status: "alive" | "dead",
): SimCitizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    cultureId: null,
    educationLevelId: null,
    givenName: id,
    id,
    namesetId: null,
    parentACitizenId: parentA,
    parentBCitizenId: parentB,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: "s1",
    sex,
    status,
    surname: null,
  };
}

// Pre-refactor matching loop: rebuilds both ancestor sets for every pair.
function buildAncestorSet(
  citizenId: string,
  depth: number,
  citizenById: Map<string, SimCitizen>,
): Set<string> {
  const result = new Set<string>();
  let frontier = new Set<string>([citizenId]);
  for (let gen = 0; gen <= depth; gen++) {
    for (const id of frontier) result.add(id);
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

function formationBefore(citizens: SimCitizen[]): number {
  const rng = createSeededRng("bench-seed");
  const citizenById = new Map(citizens.map((c) => [c.id, c]));
  const eligible = Array.from(citizenById.values())
    .filter((c) => c.status === "alive" && c.settlementId === "s1")
    .sort(compareById);
  const seekingMales: SimCitizen[] = [];
  const seekingFemales: SimCitizen[] = [];
  for (const citizen of eligible) {
    if (rng() < SEEK_CHANCE) {
      if (citizen.sex === "male") seekingMales.push(citizen);
      else seekingFemales.push(citizen);
    }
  }
  const paired = new Set<string>();
  let formed = 0;
  for (const male of seekingMales) {
    if (paired.has(male.id)) continue;
    for (const female of seekingFemales) {
      if (paired.has(female.id)) continue;
      const a = buildAncestorSet(male.id, DEPTH, citizenById);
      const b = buildAncestorSet(female.id, DEPTH, citizenById);
      let kin = false;
      for (const id of a) {
        if (b.has(id)) {
          kin = true;
          break;
        }
      }
      if (kin) continue;
      paired.add(male.id);
      paired.add(female.id);
      formed++;
      break;
    }
  }
  return formed;
}

function formationAfter(citizens: SimCitizen[]): number {
  const citizenById = new Map(citizens.map((c) => [c.id, c]));
  return applyFormationForSettlement(
    SETTLEMENT,
    citizens,
    new Set(),
    new Set(),
    new Set(),
    10,
    0,
    SEEK_CHANCE,
    createAncestorSetLookup(citizenById, DEPTH),
    createSeededRng("bench-seed"),
  ).partnershipChanges.length;
}

for (const [families, children] of [
  [4, 60],
  [8, 60],
] as const) {
  const citizens = makeDenseSettlement(families, children);

  describe(`${families} families × ${children} children (${citizens.length} citizens)`, () => {
    bench("per-pair ancestor BFS (before)", () => {
      if (formationBefore(citizens) < 0) throw new Error("unreachable");
    });

    bench("memoized ancestor lookup (after)", () => {
      if (formationAfter(citizens) < 0) throw new Error("unreachable");
    });
  });
}
