// Unit tests for phaseResourceDecay — floor(pre * decayRate / 100) arithmetic,
// zero-decay no-ops, and mutation of the shared pendingStockpiles map.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseResourceDecay } from "./phaseResourceDecay.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResourceIndex(
  resources: Record<string, number>,
): ReadonlyMap<string, { readonly decayRate: number }> {
  return new Map(
    Object.entries(resources).map(([id, decayRate]) => [id, { decayRate }]),
  );
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

describe("phaseResourceDecay — decay arithmetic", () => {
  it("computes floor(pre * decayRate / 100) and mutates the map to the post value", () => {
    // 100 * 10 / 100 = 10 exactly.
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: -10, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(90);
  });

  it("floors a fractional decay amount down rather than rounding", () => {
    // 99 * 10 / 100 = 9.9 → floor = 9.
    const pendingStockpiles = new Map([["s1:wood", 99]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: -9, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(90);
  });

  it("zero stock: decayAmount is 0, no delta emitted, no log, map left at 0", () => {
    const pendingStockpiles = new Map([["s1:wood", 0]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 50 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(0);
  });

  it("sub-unit stock below the decay threshold floors to a zero-op (e.g. 5 * 10/100 = 0.5 → 0)", () => {
    const pendingStockpiles = new Map([["s1:wood", 5]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(5);
  });

  it("zero decay rate is a no-op even with abundant stock (short-circuits before floor math)", () => {
    const pendingStockpiles = new Map([["s1:stone", 100_000]]);
    const resourcesByWorldId = makeResourceIndex({ stone: 0 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "stone", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:stone")).toBe(100_000);
  });

  it("negative pre-decay stock still floors toward more-negative (never clamped here — clamping is a separate phase)", () => {
    // -100 * 10 / 100 = -10 exactly, floor(-10) = -10 → delta = +10 → post = -90.
    const pendingStockpiles = new Map([["s1:wood", -100]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: 10, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(-90);
  });

  it("skips keys with no stockpileKeyIndex metadata entry (defensive continue)", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([]); // no metadata for "s1:wood"

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(100);
  });

  it("skips keys with no matching resource in resourcesByWorldId", () => {
    const pendingStockpiles = new Map([["s1:mystery", 100]]);
    const resourcesByWorldId = makeResourceIndex({}); // "mystery" absent
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "mystery", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:mystery")).toBe(100);
  });

  it("emits a stockpile.decayed log entry with the full pre/post/delta/decayRate payload", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({ wood: 25 });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      category: "stockpile.decayed",
      payload: {
        decayRate: 25,
        delta: -25,
        post: 75,
        pre: 100,
        resourceId: "wood",
        settlementId: "s1",
      },
      phase: "resourceDecay",
    });
  });
});

describe("phaseResourceDecay — multi-entity isolation", () => {
  it("decays multiple settlements and resources independently with no cross-contamination between map keys", () => {
    const pendingStockpiles = new Map([
      ["s1:wood", 100],
      ["s1:stone", 200],
      ["s2:wood", 50],
    ]);
    const resourcesByWorldId = makeResourceIndex({ stone: 25, wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([
      { resourceId: "wood", settlementId: "s1" },
      { resourceId: "stone", settlementId: "s1" },
      { resourceId: "wood", settlementId: "s2" },
    ]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(90); // 100 - floor(100*10/100)=10
    expect(pendingStockpiles.get("s1:stone")).toBe(150); // 200 - floor(200*25/100)=50
    expect(pendingStockpiles.get("s2:wood")).toBe(45); // 50 - floor(50*10/100)=5

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: -10, resourceId: "wood", settlementId: "s1" },
        { delta: -50, resourceId: "stone", settlementId: "s1" },
        { delta: -5, resourceId: "wood", settlementId: "s2" },
      ]),
    );
    expect(result.stockpileDeltas).toHaveLength(3);
    expect(result.logs).toHaveLength(3);
  });

  it("a zero-decay resource produces no delta while a decaying resource in the same settlement is unaffected by it", () => {
    const pendingStockpiles = new Map([
      ["s1:wood", 100], // decays
      ["s1:stone", 100], // zero decay rate — no-op
    ]);
    const resourcesByWorldId = makeResourceIndex({ stone: 0, wood: 10 });
    const stockpileKeyIndex = makeKeyIndex([
      { resourceId: "wood", settlementId: "s1" },
      { resourceId: "stone", settlementId: "s1" },
    ]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);

    expect(pendingStockpiles.get("s1:wood")).toBe(90);
    expect(pendingStockpiles.get("s1:stone")).toBe(100);
    expect(result.stockpileDeltas).toEqual([
      { delta: -10, resourceId: "wood", settlementId: "s1" },
    ]);
  });
});

describe("phaseResourceDecay — determinism", () => {
  it("produces identical output across repeated calls with equivalent input (no hidden randomness or clock reads)", () => {
    function run(): ReturnType<typeof phaseResourceDecay> {
      const pendingStockpiles = new Map([["s1:wood", 137]]);
      const resourcesByWorldId = makeResourceIndex({ wood: 7 });
      const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);
      return phaseResourceDecay(pendingStockpiles, resourcesByWorldId, stockpileKeyIndex);
    }

    const first = run();
    const second = run();

    expect(second).toEqual(first);
  });
});
