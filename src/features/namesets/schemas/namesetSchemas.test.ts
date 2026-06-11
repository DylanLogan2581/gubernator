import { describe, expect, it } from "vitest";

import { createNamesetInputSchema } from "./namesetSchemas";

const VALID_CONFIG = {
  convention: "pool",
  female_given_names: [],
  male_given_names: [],
  surnames: [],
} as const;

describe("createNamesetInputSchema", () => {
  it("accepts a seeded-style world id (not a strict RFC UUID)", () => {
    // Seed data uses fixture ids like 00000000-0000-0000-0000-000000000101,
    // which zod's strict .uuid() rejects. The schema must use the looser guid
    // check or nameset creation breaks on seeded worlds.
    const result = createNamesetInputSchema.safeParse({
      configJson: VALID_CONFIG,
      name: "Test Nameset",
      worldId: "00000000-0000-0000-0000-000000000101",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a random RFC 4122 world id", () => {
    const result = createNamesetInputSchema.safeParse({
      configJson: VALID_CONFIG,
      name: "Test Nameset",
      worldId: "3f2f1b2a-1d2e-4c3b-8a9d-0e1f2a3b4c5d",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-guid world id", () => {
    const result = createNamesetInputSchema.safeParse({
      configJson: VALID_CONFIG,
      name: "Test Nameset",
      worldId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a retired convention value", () => {
    const result = createNamesetInputSchema.safeParse({
      configJson: { ...VALID_CONFIG, convention: "random" },
      name: "Test Nameset",
      worldId: "00000000-0000-0000-0000-000000000101",
    });
    expect(result.success).toBe(false);
  });
});
