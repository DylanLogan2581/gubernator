// Phase 5 decision benchmark: does a ~200-settlement / ~100k-citizen turn leave
// memory or payload transfer as the residual bottleneck once Phases 1-4 have
// landed? Measures end-to-end engine time, peak heap, and the serialised size
// of the apply_turn_transition payload.
//
// Not part of the test suite — run with:
//   npx vitest bench supabase/functions/end-turn-simulation/turnScale.bench.ts
//
// The world is built by replicating the golden fixture's three settlements and
// padding each with filler citizens, so every phase runs on real shapes.

import { bench, describe } from "vitest";

import { makeGoldenWorldInput } from "../_shared/simulation/goldenWorldFixture.ts";
import { runSimulation } from "../_shared/simulation/runSimulation.ts";

import { mapSimulationResultToPayload } from "./transition.ts";

import type { SimulationInputState } from "../_shared/simulation/simulationTypes.ts";

// Id prefixes that are per-settlement / per-entity and must be suffixed per
// replica. Everything else (resources, jobs, blueprints, tiers, nations,
// currencies, education levels, unit types, …) is a world-level catalog shared
// across replicas.
const SCOPED_PREFIXES = [
  "s-",
  "c-",
  "sb-",
  "mp-",
  "d-",
  "tr-",
  "cp-",
  "a-",
  "au-",
  "us-",
  "pt-",
  "ee-",
  "ev-",
];

// Collections replicated per settlement group. The rest are copied once.
const SCOPED_KEYS = [
  "armies",
  "armyUnits",
  "citizenAssignments",
  "citizens",
  "constructionProjects",
  "deposits",
  "educationEnrollments",
  "events",
  "managedPopulations",
  "partnerships",
  "settlementBuildings",
  "settlements",
  "stockpiles",
  "tradeRoutes",
  "unitSoldiers",
] as const;

function suffixIds(value: unknown, suffix: string): unknown {
  if (typeof value === "string") {
    return SCOPED_PREFIXES.some((p) => value.startsWith(p)) ? `${value}${suffix}` : value;
  }
  if (Array.isArray(value)) return value.map((v) => suffixIds(v, suffix));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, suffixIds(v, suffix)]),
    );
  }
  return value;
}

/**
 * Builds a world of `replicas × 3` settlements, padded with filler citizens so
 * the total citizen population is at least `citizenTarget`.
 */
function makeScaledWorld(replicas: number, citizenTarget: number): SimulationInputState {
  const base = makeGoldenWorldInput();
  const scaled = { ...base } as Record<string, unknown>;

  for (const key of SCOPED_KEYS) {
    const source = base[key] as readonly unknown[];
    const out: unknown[] = [];
    for (let k = 0; k < replicas; k++) {
      const suffix = k === 0 ? "" : `-r${k}`;
      out.push(...(suffixIds(source, suffix) as unknown[]));
    }
    scaled[key] = out;
  }

  const settlements = scaled.settlements as { id: string }[];
  const citizens = scaled.citizens as Record<string, unknown>[];
  const assignments = scaled.citizenAssignments as Record<string, unknown>[];
  const template = citizens[0];
  const jobId = (base.jobs[0] as { id: string }).id;

  // Pad each settlement evenly with working adults until the target is met.
  const fillerPerSettlement = Math.max(
    0,
    Math.ceil((citizenTarget - citizens.length) / settlements.length),
  );
  let n = 0;
  for (const settlement of settlements) {
    for (let i = 0; i < fillerPerSettlement; i++) {
      const id = `c-fill-${n++}`;
      citizens.push({
        ...template,
        bornOnTurnNumber: 20 - (i % 20),
        givenName: id,
        id,
        parentACitizenId: null,
        parentBCitizenId: null,
        roleNationId: null,
        roleSettlementId: null,
        roleType: "none",
        settlementId: settlement.id,
        sex: i % 2 === 0 ? "male" : "female",
        status: "alive",
      });
      assignments.push({ citizenId: id, jobId, settlementId: settlement.id });
    }
  }

  return scaled as unknown as SimulationInputState;
}

// Node/Deno both expose memory counters, but under different names and neither
// is in this directory's Deno-flavoured lib. Reach for them dynamically.
type MemoryUsage = { heapUsed: number; rss: number };
const runtime = globalThis as unknown as {
  gc?: () => void;
  process?: { memoryUsage: () => MemoryUsage };
};

function memory(): MemoryUsage {
  return runtime.process?.memoryUsage() ?? { heapUsed: 0, rss: 0 };
}

function heapMb(): number {
  return memory().heapUsed / 1024 / 1024;
}

const encoder = new TextEncoder();

function jsonMb(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length / 1024 / 1024;
}

const REPLICAS = 67; // 201 settlements
const CITIZEN_TARGET = 100_000;

const world = makeScaledWorld(REPLICAS, CITIZEN_TARGET);

// One-off measurement pass; vitest's bench reporter only gives timings, so the
// memory/payload figures are printed once here.
{
  runtime.gc?.();
  const before = heapMb();
  const inputMb = jsonMb(world);
  const result = runSimulation(world, "tt-bench");
  const afterSim = heapMb();
  const payload = mapSimulationResultToPayload(result, world);
  const payloadMb = jsonMb(payload);
  const peak = heapMb();

  // Manually-run measurement harness, not app code — printing is the output.
  // eslint-disable-next-line no-restricted-syntax
  console.log(
    [
      "",
      "=== Phase 5 gate measurement ===",
      `settlements:            ${world.settlements.length}`,
      `citizens:               ${world.citizens.length}`,
      `input state JSON:       ${inputMb.toFixed(1)} MB`,
      `apply payload JSON:     ${payloadMb.toFixed(1)} MB`,
      `heap before run:        ${before.toFixed(1)} MB`,
      `heap after runSimulation: ${afterSim.toFixed(1)} MB`,
      `heap after payload map: ${peak.toFixed(1)} MB`,
      `rss:                    ${(memory().rss / 1024 / 1024).toFixed(1)} MB`,
      "",
    ].join("\n"),
  );
}

describe(`${world.settlements.length} settlements × ${world.citizens.length} citizens`, () => {
  bench("runSimulation", () => {
    runSimulation(world, "tt-bench");
  }, { iterations: 3, warmupIterations: 1 });

  bench("runSimulation + payload map + stringify", () => {
    const result = runSimulation(world, "tt-bench");
    JSON.stringify(mapSimulationResultToPayload(result, world));
  }, { iterations: 3, warmupIterations: 1 });
});
