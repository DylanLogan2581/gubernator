// Unit tests for phaseResourceDecay — percent/flat, growth/decay arithmetic,
// clamping to [0, effective storage cap], and mutation of the shared
// pendingStockpiles map.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseResourceDecay, type ResourceChangeMode } from "./phaseResourceDecay.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResourceIndex(
  resources: Record<string, { changeMode: ResourceChangeMode; changeAmount: number }>,
): ReadonlyMap<string, { readonly changeMode: ResourceChangeMode; readonly changeAmount: number }> {
  return new Map(Object.entries(resources));
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

const NO_CAPS: ReadonlyMap<string, number> = new Map();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseResourceDecay — percent mode", () => {
  it("computes floor(pre * |amount| / 100) and negates for percent decay", () => {
    // 100 * 10 / 100 = 10 exactly.
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: -10, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(90);
  });

  it("floors a fractional percent decay amount down rather than rounding", () => {
    // 99 * 10 / 100 = 9.9 → floor = 9.
    const pendingStockpiles = new Map([["s1:wood", 99]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: -9, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(90);
  });

  it("computes percent growth and floors the fractional amount down", () => {
    // 99 * 10 / 100 = 9.9 → floor = 9.
    const pendingStockpiles = new Map([["s1:wood", 99]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: 10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: 9, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(108);
  });

  it("zero stock: computed amount is 0, no delta emitted, no log, map left at 0", () => {
    const pendingStockpiles = new Map([["s1:wood", 0]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -50, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(0);
  });

  it("sub-unit stock below the decay threshold floors to a zero-op (e.g. 5 * 10/100 = 0.5 → 0)", () => {
    const pendingStockpiles = new Map([["s1:wood", 5]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(5);
  });

  it("zero change amount is a no-op even with abundant stock (short-circuits before floor math)", () => {
    const pendingStockpiles = new Map([["s1:stone", 100_000]]);
    const resourcesByWorldId = makeResourceIndex({
      stone: { changeAmount: 0, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "stone", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:stone")).toBe(100_000);
  });

  it("skips keys with no stockpileKeyIndex metadata entry (defensive continue)", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([]); // no metadata for "s1:wood"

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(100);
  });

  it("skips keys with no matching resource in resourcesByWorldId", () => {
    const pendingStockpiles = new Map([["s1:mystery", 100]]);
    const resourcesByWorldId = makeResourceIndex({}); // "mystery" absent
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "mystery", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(pendingStockpiles.get("s1:mystery")).toBe(100);
  });

  it("emits a stockpile.changed log entry with the full pre/post/delta/changeMode/changeAmount payload", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -25, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      category: "stockpile.changed",
      payload: {
        changeAmount: -25,
        changeMode: "percent",
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

describe("phaseResourceDecay — flat mode", () => {
  it("subtracts a flat amount directly (no floor math)", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -50, changeMode: "flat" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: -50, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(50);
  });

  it("adds a flat amount directly", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: 10, changeMode: "flat" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: 10, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(110);
  });
});

describe("phaseResourceDecay — clamping", () => {
  it("clamps flat decay at zero rather than going negative", () => {
    const pendingStockpiles = new Map([["s1:wood", 30]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: -50, changeMode: "flat" },
    });
    const caps = new Map([["s1:wood", 1000]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, caps, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: -30, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(0);
  });

  it("clamps flat growth at the effective storage cap", () => {
    const pendingStockpiles = new Map([["s1:wood", 95]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: 10, changeMode: "flat" },
    });
    const caps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, caps, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: 5, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(100);
  });

  it("clamps percent growth at the effective storage cap", () => {
    const pendingStockpiles = new Map([["s1:wood", 95]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: 200, changeMode: "percent" },
    });
    const caps = new Map([["s1:wood", 100]]);
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, caps, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: 5, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(100);
  });

  it("emits no delta/log when the clamped post equals pre", () => {
    const pendingStockpiles = new Map([["s1:wood", 100]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: 10, changeMode: "flat" },
    });
    const caps = new Map([["s1:wood", 100]]); // already at cap
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, caps, stockpileKeyIndex);

    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(pendingStockpiles.get("s1:wood")).toBe(100);
  });

  it("skips clamping when no effective cap entry exists for the key", () => {
    const pendingStockpiles = new Map([["s1:wood", 95]]);
    const resourcesByWorldId = makeResourceIndex({
      wood: { changeAmount: 10, changeMode: "flat" },
    });
    const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

    expect(result.stockpileDeltas).toEqual([{ delta: 10, resourceId: "wood", settlementId: "s1" }]);
    expect(pendingStockpiles.get("s1:wood")).toBe(105);
  });
});

describe("phaseResourceDecay — multi-entity isolation", () => {
  it("decays multiple settlements and resources independently with no cross-contamination between map keys", () => {
    const pendingStockpiles = new Map([
      ["s1:wood", 100],
      ["s1:stone", 200],
      ["s2:wood", 50],
    ]);
    const resourcesByWorldId = makeResourceIndex({
      stone: { changeAmount: -25, changeMode: "percent" },
      wood: { changeAmount: -10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([
      { resourceId: "wood", settlementId: "s1" },
      { resourceId: "stone", settlementId: "s1" },
      { resourceId: "wood", settlementId: "s2" },
    ]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

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

  it("a zero-change resource produces no delta while a decaying resource in the same settlement is unaffected by it", () => {
    const pendingStockpiles = new Map([
      ["s1:wood", 100], // decays
      ["s1:stone", 100], // zero change amount — no-op
    ]);
    const resourcesByWorldId = makeResourceIndex({
      stone: { changeAmount: 0, changeMode: "percent" },
      wood: { changeAmount: -10, changeMode: "percent" },
    });
    const stockpileKeyIndex = makeKeyIndex([
      { resourceId: "wood", settlementId: "s1" },
      { resourceId: "stone", settlementId: "s1" },
    ]);

    const result = phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);

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
      const resourcesByWorldId = makeResourceIndex({
        wood: { changeAmount: -7, changeMode: "percent" },
      });
      const stockpileKeyIndex = makeKeyIndex([{ resourceId: "wood", settlementId: "s1" }]);
      return phaseResourceDecay(pendingStockpiles, resourcesByWorldId, NO_CAPS, stockpileKeyIndex);
    }

    const first = run();
    const second = run();

    expect(second).toEqual(first);
  });
});
