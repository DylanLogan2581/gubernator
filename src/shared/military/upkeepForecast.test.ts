import { describe, expect, it } from "vitest";

import {
  computeArmyUpkeepRequirement,
  computeUnitProjectedDesertion,
  isUpkeepShortfall,
} from "@/shared/military";

describe("computeArmyUpkeepRequirement", () => {
  it("sums per-resource upkeep across units, floored per unit-resource pair", () => {
    const required = computeArmyUpkeepRequirement([
      {
        desertionRate: 0.1,
        soldierCount: 3,
        unitId: "unit-1",
        upkeepCostsJson: [{ amount: 0.3333, resourceId: "food" }],
      },
      {
        desertionRate: 0.1,
        soldierCount: 5,
        unitId: "unit-2",
        upkeepCostsJson: [
          { amount: 0.3333, resourceId: "food" },
          { amount: 1, resourceId: "gold" },
        ],
      },
    ]);

    // unit-1: floor(0.3333 * 3 * 10000) / 10000 = 0.9999
    // unit-2: floor(0.3333 * 5 * 10000) / 10000 = 1.6665
    expect(required.get("food")).toBeCloseTo(0.9999 + 1.6665);
    expect(required.get("gold")).toBe(5);
  });

  it("skips units with zero soldiers", () => {
    const required = computeArmyUpkeepRequirement([
      {
        desertionRate: 0,
        soldierCount: 0,
        unitId: "unit-1",
        upkeepCostsJson: [{ amount: 5, resourceId: "food" }],
      },
    ]);

    expect(required.size).toBe(0);
  });
});

describe("isUpkeepShortfall", () => {
  it("is true when any required resource exceeds what's available", () => {
    const required = new Map([
      ["food", 10],
      ["gold", 5],
    ]);
    expect(
      isUpkeepShortfall(
        required,
        new Map([
          ["food", 10],
          ["gold", 4],
        ]),
      ),
    ).toBe(true);
    expect(
      isUpkeepShortfall(
        required,
        new Map([
          ["food", 10],
          ["gold", 5],
        ]),
      ),
    ).toBe(false);
  });

  it("treats a missing available entry as zero", () => {
    const required = new Map([["food", 1]]);
    expect(isUpkeepShortfall(required, new Map())).toBe(true);
  });

  it("ignores non-positive requirements", () => {
    const required = new Map([["food", 0]]);
    expect(isUpkeepShortfall(required, new Map())).toBe(false);
  });
});

describe("computeUnitProjectedDesertion", () => {
  it("floors soldiers * desertionRate", () => {
    expect(computeUnitProjectedDesertion(20, 0.25)).toBe(5);
  });

  it("deserts a minimum of 1 when the rate is positive and soldiers exist", () => {
    expect(computeUnitProjectedDesertion(3, 0.1)).toBe(1);
  });

  it("returns 0 when there are no soldiers or the rate is zero", () => {
    expect(computeUnitProjectedDesertion(0, 0.5)).toBe(0);
    expect(computeUnitProjectedDesertion(10, 0)).toBe(0);
  });

  it("never deserts more soldiers than exist", () => {
    expect(computeUnitProjectedDesertion(2, 1)).toBe(2);
  });
});
