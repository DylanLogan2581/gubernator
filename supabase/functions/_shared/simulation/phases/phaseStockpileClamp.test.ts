// Unit tests for phaseStockpileClamp — clamps every pending stockpile to
// [0, effectiveCap], falling back to the base cap, with "negative"/"over_cap"
// reason tagging and a no-op fast path when already in range.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseStockpileClamp } from "./phaseStockpileClamp.ts";
import { makeContext } from "./testFixtures.ts";

import type { SimStockpile } from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStockpile(overrides: Partial<SimStockpile> & { settlementId: string; resourceId: string }): SimStockpile {
  return {
    cap: 100,
    quantity: 0,
    ...overrides,
  };
}

function makeKeyIndex(
  entries: readonly { settlementId: string; resourceId: string }[],
): ReadonlyMap<string, { readonly settlementId: string; readonly resourceId: string }> {
  return new Map(
    entries.map(({ settlementId, resourceId }) => [
      `${settlementId}:${resourceId}`,
      { resourceId, settlementId },
    ]),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseStockpileClamp — clamp arithmetic", () => {
  it("exact-cap stock is left untouched (no delta, no log — pre === post fast path)", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const effectiveStorageCaps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(100);
  });

  it("over-cap stock is clamped down to the cap with a negative delta and reason 'over_cap'", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", 150]]);
    const effectiveStorageCaps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(100);
    expect(result.stockpileDeltas).toEqual([{ delta: -50, resourceId: "wood", settlementId: "s1" }]);
    expect(result.logs[0]).toMatchObject({
      category: "stockpile.clamped",
      payload: {
        delta: -50,
        effectiveCap: 100,
        post: 100,
        pre: 150,
        reason: "over_cap",
        resourceId: "wood",
        settlementId: "s1",
      },
      phase: "stockpileClamp",
    });
  });

  it("negative stock is clamped up to zero with a positive delta and reason 'negative'", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", -30]]);
    const effectiveStorageCaps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(0);
    expect(result.stockpileDeltas).toEqual([{ delta: 30, resourceId: "wood", settlementId: "s1" }]);
    expect(result.logs[0]).toMatchObject({
      payload: { delta: 30, post: 0, pre: -30, reason: "negative" },
    });
  });

  it("zero stock within range is a no-op (0 is a valid point in [0, cap])", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", 0]]);
    const effectiveStorageCaps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(0);
  });

  it("falls back to the base cap from context.input.stockpiles when effectiveStorageCaps has no entry for the key", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 50, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", 80]]);
    const effectiveStorageCaps = new Map<string, number>(); // no override — use base cap 50
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(50);
    expect(result.stockpileDeltas).toEqual([{ delta: -30, resourceId: "wood", settlementId: "s1" }]);
    expect(result.logs[0]).toMatchObject({ payload: { effectiveCap: 50 } });
  });

  it("skips a key with no cap anywhere (neither effectiveStorageCaps nor base stockpiles) — no crash, no delta", () => {
    const ctx = makeContext({ stockpiles: [] });
    const pendingStockpiles = new Map([["s1:mystery", 999]]);
    const effectiveStorageCaps = new Map<string, number>();
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "mystery", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:mystery")).toBe(999);
  });

  it("skips a key with no stockpileKeyIndex metadata even when a cap exists (defensive continue)", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", 150]]);
    const effectiveStorageCaps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([]); // no metadata for "s1:wood"

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
    // Map is left unclamped since the phase bails before writing back.
    expect(pendingStockpiles.get("s1:wood")).toBe(150);
  });

  it("effectiveCap of 0 clamps any positive stock down to zero (fully-lost-storage edge case)", () => {
    const ctx = makeContext({
      stockpiles: [makeStockpile({ cap: 0, resourceId: "wood", settlementId: "s1" })],
    });
    const pendingStockpiles = new Map([["s1:wood", 42]]);
    const effectiveStorageCaps = new Map([["s1:wood", 0]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(0);
    expect(result.stockpileDeltas).toEqual([{ delta: -42, resourceId: "wood", settlementId: "s1" }]);
    expect(result.logs[0]).toMatchObject({ payload: { reason: "over_cap" } });
  });
});

describe("phaseStockpileClamp — multi-entity isolation", () => {
  it("clamps multiple settlements and resources independently with no cross-contamination between map keys", () => {
    const ctx = makeContext({
      stockpiles: [
        makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" }),
        makeStockpile({ cap: 50, resourceId: "stone", settlementId: "s1" }),
        makeStockpile({ cap: 20, resourceId: "wood", settlementId: "s2" }),
      ],
    });
    const pendingStockpiles = new Map([
      ["s1:wood", 200], // over cap → clamp to 100
      ["s1:stone", -5], // negative → clamp to 0
      ["s2:wood", 10], // in range → no-op
    ]);
    const effectiveStorageCaps = new Map([
      ["s1:wood", 100],
      ["s1:stone", 50],
      ["s2:wood", 20],
    ]);
    const stockpileKeyIndex = makeKeyIndex([
      { resourceId: "wood", settlementId: "s1" },
      { resourceId: "stone", settlementId: "s1" },
      { resourceId: "wood", settlementId: "s2" },
    ]);

    const result = phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(100);
    expect(pendingStockpiles.get("s1:stone")).toBe(0);
    expect(pendingStockpiles.get("s2:wood")).toBe(10); // untouched

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: -100, resourceId: "wood", settlementId: "s1" },
        { delta: 5, resourceId: "stone", settlementId: "s1" },
      ]),
    );
    expect(result.stockpileDeltas).toHaveLength(2); // s2:wood produced no delta
    expect(result.logs).toHaveLength(2);
    expect(result.logs.map((l) => l.payload.reason).sort()).toEqual(["negative", "over_cap"]);
  });
});

describe("phaseStockpileClamp — determinism", () => {
  it("produces identical output across repeated calls with equivalent input (no hidden randomness or clock reads)", () => {
    function run(): ReturnType<typeof phaseStockpileClamp> {
      const ctx = makeContext({
        stockpiles: [makeStockpile({ cap: 100, resourceId: "wood", settlementId: "s1" })],
      });
      const pendingStockpiles = new Map([["s1:wood", 175]]);
      const effectiveStorageCaps = new Map([["s1:wood", 100]]);
      const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);
      return phaseStockpileClamp(ctx, pendingStockpiles, effectiveStorageCaps, stockpileKeyIndex);
    }

    const first = run();
    const second = run();

    expect(second).toEqual(first);
  });
});
