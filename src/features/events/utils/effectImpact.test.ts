import { describe, expect, it } from "vitest";

import { computeEffectImpact, resolveSettlementCount } from "./effectImpact";

const SETTLEMENTS = [
  { id: "s1", nationId: "n1" },
  { id: "s2", nationId: "n1" },
  { id: "s3", nationId: "n2" },
] as const;

// ---------------------------------------------------------------------------
// resolveSettlementCount
// ---------------------------------------------------------------------------
describe("resolveSettlementCount", () => {
  it("world scope → all settlements", () => {
    expect(resolveSettlementCount("world", [], SETTLEMENTS)).toBe(3);
  });

  it("settlement scope → selectedIds length", () => {
    expect(
      resolveSettlementCount("settlement", ["s1", "s2"], SETTLEMENTS),
    ).toBe(2);
  });

  it("settlement scope with no ids → 0", () => {
    expect(resolveSettlementCount("settlement", [], SETTLEMENTS)).toBe(0);
  });

  it("nation scope → filters settlements by nationId", () => {
    expect(resolveSettlementCount("nation", ["n1"], SETTLEMENTS)).toBe(2);
  });

  it("nation scope multiple nations", () => {
    expect(resolveSettlementCount("nation", ["n1", "n2"], SETTLEMENTS)).toBe(3);
  });

  it("nation scope unknown nation → 0", () => {
    expect(resolveSettlementCount("nation", ["n999"], SETTLEMENTS)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeEffectImpact — scope-based effects
// ---------------------------------------------------------------------------
describe("computeEffectImpact — scope-based effects", () => {
  const SCOPE_TYPES = [
    "population_boost",
    "population_loss",
    "resource_grant",
    "resource_drain",
    "consumption_multiplier",
    "production_multiplier",
    "upkeep_multiplier",
    "deposit_discovered",
    "modify_resource",
  ] as const;

  for (const type of SCOPE_TYPES) {
    it(`${type}: returns settlements category with scope count`, () => {
      const impact = computeEffectImpact(
        { effectType: type },
        "world",
        [],
        SETTLEMENTS,
      );
      expect(impact).toEqual({ category: "settlements", count: 3 });
    });

    it(`${type}: zero count when scope has no settlements`, () => {
      const impact = computeEffectImpact(
        { effectType: type },
        "settlement",
        [],
        SETTLEMENTS,
      );
      expect(impact).toEqual({ category: "settlements", count: 0 });
    });
  }
});

// ---------------------------------------------------------------------------
// computeEffectImpact — building_destroyed
// ---------------------------------------------------------------------------
describe("computeEffectImpact — building_destroyed", () => {
  it("multiple buildings via settlementBuildingIds", () => {
    const impact = computeEffectImpact(
      {
        effectType: "building_destroyed",
        settlementBuildingIds: ["b1", "b2", "b3"],
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "buildings", count: 3 });
  });

  it("single building via settlementBuildingId", () => {
    const impact = computeEffectImpact(
      {
        effectType: "building_destroyed",
        settlementBuildingId: "b1",
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "buildings", count: 1 });
  });

  it("no building id → zero targets", () => {
    const impact = computeEffectImpact(
      {
        effectType: "building_destroyed",
        settlementBuildingId: null,
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "buildings", count: 0 });
  });

  it("prefers settlementBuildingIds over singular when both present", () => {
    const impact = computeEffectImpact(
      {
        effectType: "building_destroyed",
        settlementBuildingId: "b1",
        settlementBuildingIds: ["b1", "b2"],
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "buildings", count: 2 });
  });
});

// ---------------------------------------------------------------------------
// computeEffectImpact — deposit_destroyed
// ---------------------------------------------------------------------------
describe("computeEffectImpact — deposit_destroyed", () => {
  it("multiple deposits via depositInstanceIds", () => {
    const impact = computeEffectImpact(
      {
        effectType: "deposit_destroyed",
        depositInstanceIds: ["d1", "d2"],
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "deposits", count: 2 });
  });

  it("single deposit via depositInstanceId", () => {
    const impact = computeEffectImpact(
      {
        effectType: "deposit_destroyed",
        depositInstanceId: "d1",
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "deposits", count: 1 });
  });

  it("no deposit id → zero targets", () => {
    const impact = computeEffectImpact(
      {
        effectType: "deposit_destroyed",
        depositInstanceId: null,
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "deposits", count: 0 });
  });
});

// ---------------------------------------------------------------------------
// computeEffectImpact — managed_population_change
// ---------------------------------------------------------------------------
describe("computeEffectImpact — managed_population_change", () => {
  it('mode "all" → scope settlement count', () => {
    const impact = computeEffectImpact(
      {
        effectType: "managed_population_change",
        managedPopulationMode: "all",
      },
      "nation",
      ["n1"],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "populations", count: 2 });
  });

  it('mode "type" → scope settlement count', () => {
    const impact = computeEffectImpact(
      {
        effectType: "managed_population_change",
        managedPopulationMode: "type",
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "populations", count: 3 });
  });

  it('mode "instance" with instance id → count 1', () => {
    const impact = computeEffectImpact(
      {
        effectType: "managed_population_change",
        managedPopulationMode: "instance",
        managedPopulationInstanceId: "mp1",
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "populations", count: 1 });
  });

  it("no mode, with instance id → count 1", () => {
    const impact = computeEffectImpact(
      {
        effectType: "managed_population_change",
        managedPopulationInstanceId: "mp1",
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "populations", count: 1 });
  });

  it("no mode, no instance id → zero targets", () => {
    const impact = computeEffectImpact(
      {
        effectType: "managed_population_change",
        managedPopulationInstanceId: null,
      },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toEqual({ category: "populations", count: 0 });
  });
});

// ---------------------------------------------------------------------------
// computeEffectImpact — unknown type
// ---------------------------------------------------------------------------
describe("computeEffectImpact — unknown type", () => {
  it("returns null for unknown effect type", () => {
    const impact = computeEffectImpact(
      { effectType: "totally_unknown_type" },
      "world",
      [],
      SETTLEMENTS,
    );
    expect(impact).toBeNull();
  });
});
