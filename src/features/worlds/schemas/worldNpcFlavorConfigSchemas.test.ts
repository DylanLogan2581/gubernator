import { describe, expect, it } from "vitest";

import { npcFlavorInputLimits } from "@/lib/inputLimits";

import { worldNpcFlavorConfigSchema } from "./worldNpcFlavorConfigSchemas";

const emptyPool: string[] = [];
const validEntry = "Brave but reckless";

const validConfig = {
  contradictions: [validEntry],
  flaws: [validEntry],
  goals: [validEntry],
  traits: [validEntry],
};

describe("worldNpcFlavorConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = worldNpcFlavorConfigSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
  });

  it("accepts empty pools", () => {
    const result = worldNpcFlavorConfigSchema.safeParse({
      contradictions: emptyPool,
      flaws: emptyPool,
      goals: emptyPool,
      traits: emptyPool,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a pool at exactly the maximum entry count", () => {
    const maxPool = Array.from(
      { length: npcFlavorInputLimits.poolSizeMax },
      (_, i) => `entry-${i}`,
    );

    const result = worldNpcFlavorConfigSchema.safeParse({
      ...validConfig,
      traits: maxPool,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a pool with one entry over the maximum entry count", () => {
    const oversizedPool = Array.from(
      { length: npcFlavorInputLimits.poolSizeMax + 1 },
      (_, i) => `entry-${i}`,
    );

    const result = worldNpcFlavorConfigSchema.safeParse({
      ...validConfig,
      traits: oversizedPool,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an entry at exactly the maximum character length", () => {
    const maxEntry = "x".repeat(npcFlavorInputLimits.poolEntryMax);

    const result = worldNpcFlavorConfigSchema.safeParse({
      ...validConfig,
      flaws: [maxEntry],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an entry one character over the maximum length", () => {
    const tooLongEntry = "x".repeat(npcFlavorInputLimits.poolEntryMax + 1);

    const result = worldNpcFlavorConfigSchema.safeParse({
      ...validConfig,
      flaws: [tooLongEntry],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a pool containing an empty string entry", () => {
    const result = worldNpcFlavorConfigSchema.safeParse({
      ...validConfig,
      goals: [""],
    });

    expect(result.success).toBe(false);
  });
});
