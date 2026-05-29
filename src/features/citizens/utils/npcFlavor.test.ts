import { describe, expect, it } from "vitest";

import { createSeededRng, mulberry32 } from "@/lib/seededRng";

import {
  emptyNpcFlavor,
  generateNpcFlavor,
  renderNpcFlavorLine,
  UNASSIGNED_ROLE_LABEL,
  type NpcFlavorConfig,
} from "./npcFlavor";

const FULL_CONFIG: NpcFlavorConfig = {
  contradictions: ["mourns a friend they betrayed", "loves their rival"],
  flaws: ["pride", "envy", "an addiction to risk"],
  goals: ["a seat on the council", "to restore their family's name"],
  traits: ["earnest", "wry", "patient", "haunted", "boisterous"],
};

describe("generateNpcFlavor", () => {
  it("is deterministic for the same seed", () => {
    const a = generateNpcFlavor(FULL_CONFIG, mulberry32(99));
    const b = generateNpcFlavor(FULL_CONFIG, mulberry32(99));
    expect(a).toEqual(b);
  });

  it("can produce different flavors for different seeds", () => {
    const a = generateNpcFlavor(FULL_CONFIG, mulberry32(1));
    const b = generateNpcFlavor(FULL_CONFIG, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("returns distinct traits when the traits list has >= 2 entries", () => {
    // Try many seeds to confirm the distinctness invariant always holds.
    for (let seed = 0; seed < 50; seed += 1) {
      const flavor = generateNpcFlavor(FULL_CONFIG, mulberry32(seed));
      expect(flavor.trait1).not.toBe(flavor.trait2);
    }
  });

  it("returns the same trait twice when only one trait is configured", () => {
    const config: NpcFlavorConfig = {
      ...FULL_CONFIG,
      traits: ["solitary"],
    };
    const flavor = generateNpcFlavor(config, mulberry32(7));
    expect(flavor.trait1).toBe("solitary");
    expect(flavor.trait2).toBe("solitary");
  });

  it("returns empty strings for slots whose list is empty", () => {
    const config: NpcFlavorConfig = {
      contradictions: [],
      flaws: [],
      goals: [],
      traits: [],
    };
    expect(generateNpcFlavor(config, mulberry32(0))).toEqual({
      contradiction: "",
      flaw: "",
      goal: "",
      trait1: "",
      trait2: "",
    });
  });

  it("draws each slot from its configured pool", () => {
    const flavor = generateNpcFlavor(FULL_CONFIG, createSeededRng("npc-1"));
    expect(FULL_CONFIG.traits).toContain(flavor.trait1);
    expect(FULL_CONFIG.traits).toContain(flavor.trait2);
    expect(FULL_CONFIG.contradictions).toContain(flavor.contradiction);
    expect(FULL_CONFIG.goals).toContain(flavor.goal);
    expect(FULL_CONFIG.flaws).toContain(flavor.flaw);
  });
});

describe("renderNpcFlavorLine", () => {
  const flavor = {
    contradiction: "longs for the old empire",
    flaw: "a brittle pride",
    goal: "a quiet life by the sea",
    trait1: "earnest",
    trait2: "wry",
  };

  it("formats a complete sentence with the supplied role", () => {
    expect(renderNpcFlavorLine(flavor, "Baker")).toBe(
      "A Baker who is earnest, wry, but secretly longs for the old empire. They want a quiet life by the sea but are prevented by a brittle pride.",
    );
  });

  it("substitutes the Unassigned label when role is null", () => {
    expect(renderNpcFlavorLine(flavor, null)).toContain(
      `A ${UNASSIGNED_ROLE_LABEL} who is`,
    );
  });

  it("substitutes the Unassigned label when role is blank", () => {
    expect(renderNpcFlavorLine(flavor, "   ")).toContain(
      `A ${UNASSIGNED_ROLE_LABEL} who is`,
    );
  });

  it("falls back to placeholder phrases for empty slots", () => {
    const result = renderNpcFlavorLine(emptyNpcFlavor(), "Scribe");
    expect(result).toContain("mysterious");
    expect(result).toContain("unreadable");
    expect(result).toContain("keeps their secrets close");
    expect(result).toContain("something they have yet to name");
    expect(result).toContain("something they will not admit");
  });
});
