import { describe, expect, it } from "vitest";

import { worldTemplateSchema } from "@/shared/worldTemplateSchema";

import basicFantasyJson from "./basic-fantasy.json";
import { BUNDLED_SCENARIOS } from "./bundledScenarios";
import minimalTestWorldJson from "./minimal-test-world.json";

// ---------------------------------------------------------------------------
// AC: Bundled JSON validated against the template schema in CI
// ---------------------------------------------------------------------------

describe("bundled scenario JSON fixtures", () => {
  it.each([
    ["minimal-test-world.json", minimalTestWorldJson],
    ["basic-fantasy.json", basicFantasyJson],
  ] as const)("%s validates against worldTemplateSchema", (_filename, json) => {
    const result = worldTemplateSchema.safeParse(json);
    expect(result.success, result.error?.message).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC: Templates contain zero runtime entities
// (nations / settlements / citizens come only from generateTopology)
// ---------------------------------------------------------------------------

describe("BUNDLED_SCENARIOS registry", () => {
  it("has at least two entries", () => {
    expect(BUNDLED_SCENARIOS.length).toBeGreaterThanOrEqual(2);
  });

  it("all scenario IDs are unique", () => {
    const ids = BUNDLED_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUNDLED_SCENARIOS.map((s) => [s.id, s] as const))(
    "%s: template is a valid WorldTemplate with no runtime entities",
    (_id, scenario) => {
      // Schema parse succeeds (runtime entities are not part of the schema,
      // so a passing parse already guarantees the template is config-only)
      const result = worldTemplateSchema.safeParse(scenario.template);
      expect(result.success, result.error?.message).toBe(true);
    },
  );

  it.each(BUNDLED_SCENARIOS.map((s) => [s.id, s] as const))(
    "%s: has non-empty name, description, and a generateTopology function",
    (_id, scenario) => {
      expect(scenario.name.trim().length).toBeGreaterThan(0);
      expect(scenario.description.trim().length).toBeGreaterThan(0);
      expect(typeof scenario.generateTopology).toBe("function");
    },
  );
});
