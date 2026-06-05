import { describe, expect, it } from "vitest";

import { namingInputLimits } from "@/lib/inputLimits";

import { worldNamingConfigSchema } from "./worldNamingConfigSchemas";

const validConfig = {
  convention: "random" as const,
  female_given_names: ["Alice"],
  male_given_names: ["Bob"],
  surnames: ["Smith"],
};

describe("worldNamingConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = worldNamingConfigSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
  });

  it("accepts empty name pools", () => {
    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      female_given_names: [],
      male_given_names: [],
      surnames: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts all valid convention values", () => {
    for (const convention of [
      "random",
      "patronymic",
      "matronymic",
      "inherited family name",
      "manual",
    ] as const) {
      const result = worldNamingConfigSchema.safeParse({
        ...validConfig,
        convention,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown convention", () => {
    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      convention: "unknown-convention",
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate entries in the male name pool", () => {
    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      male_given_names: ["Alice", "Alice"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate entries in the female name pool", () => {
    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      female_given_names: ["Bob", "Bob"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a pool with unique entries at exactly the maximum size", () => {
    const maxPool = Array.from(
      { length: namingInputLimits.namePoolSizeMax },
      (_, i) => `name-${String(i)}`,
    );

    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      male_given_names: maxPool,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a pool with one entry over the maximum size", () => {
    const oversizedPool = Array.from(
      { length: namingInputLimits.namePoolSizeMax + 1 },
      (_, i) => `name-${String(i)}`,
    );

    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      male_given_names: oversizedPool,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an entry at exactly the maximum character length", () => {
    const maxEntry = "x".repeat(namingInputLimits.namePoolEntryMax);

    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      male_given_names: [maxEntry],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an entry one character over the maximum length", () => {
    const tooLongEntry = "x".repeat(namingInputLimits.namePoolEntryMax + 1);

    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      male_given_names: [tooLongEntry],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty string entry in a pool", () => {
    const result = worldNamingConfigSchema.safeParse({
      ...validConfig,
      male_given_names: [""],
    });

    expect(result.success).toBe(false);
  });
});
