// Golden determinism regression test for the turn simulation engine (#1273).
//
// Runs `runSimulation` (and `computeForecastSnapshot`) over a committed,
// populated multi-settlement world fixture at a pinned world id + turn number,
// and asserts the serialized output is byte-identical to the committed golden.
//
// The seeded RNG threads a single mutable stream through settlements in
// iteration order, so ANY regrouping, reordering, or batching inside the
// engine changes the output. That is exactly what this test is here to catch:
// the Phase 3 engine optimizations must be output-preserving.
//
// ---------------------------------------------------------------------------
// Regenerating the golden
// ---------------------------------------------------------------------------
// When an engine change is DELIBERATE, regenerate and review the diff:
//
//   npm run test:golden:update
//
// (equivalently `npx vitest run
// supabase/functions/end-turn-simulation/goldenDeterminism.test.ts -u`)
//
// Then inspect `simulation.golden.json` in the commit — an unexpected diff
// there means the change was not output-preserving.

import { describe, expect, it } from "vitest";

import {
  GOLDEN_TRANSITION_ID,
  makeGoldenWorldInput,
} from "../_shared/simulation/goldenWorldFixture.ts";
import { runSimulation } from "../_shared/simulation/runSimulation.ts";

import { computeForecastSnapshot } from "./forecast.ts";

const GOLDEN_PATH = "./simulation.golden.json";

function computeGolden(): { simulation: unknown; forecast: unknown } {
  const input = makeGoldenWorldInput();
  const simulation = runSimulation(input, GOLDEN_TRANSITION_ID);
  const forecast = computeForecastSnapshot(simulation, input);
  return { simulation, forecast };
}

describe("golden determinism", () => {
  it("produces output identical to the committed golden", async () => {
    const actual = `${JSON.stringify(computeGolden(), null, 2)}\n`;
    await expect(actual).toMatchFileSnapshot(GOLDEN_PATH);
  });

  it("produces identical output across repeated runs", () => {
    expect(JSON.stringify(computeGolden())).toBe(
      JSON.stringify(computeGolden()),
    );
  });

  it("exercises a broad slice of the engine", () => {
    // Guards against the golden silently degrading into an empty-world
    // snapshot: if a future fixture edit stops producing these outputs, the
    // golden would still "pass" while covering almost nothing.
    const { simulation } = computeGolden();
    const result = simulation as ReturnType<typeof runSimulation>;

    expect(result.settlementSnapshots.length).toBe(3);
    expect(result.resourceSnapshots.length).toBeGreaterThan(5);
    expect(result.stockpileDeltas.length).toBeGreaterThan(5);
    expect(result.logEntries.length).toBeGreaterThan(5);
    expect(result.nationTurnSnapshots.length).toBeGreaterThan(0);
    expect(result.partnershipChanges.length).toBeGreaterThan(0);
    expect(result.citizenBirths.length).toBeGreaterThan(0);
    expect(result.citizenDeaths.length).toBeGreaterThan(0);
    expect(result.tradeRouteOutcomes.length).toBe(1);
  });
});
