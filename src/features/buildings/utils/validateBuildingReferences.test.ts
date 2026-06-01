import { describe, expect, it } from "vitest";

import { validateBlueprintTierReferencesAgainstWorld } from "./validateBuildingReferences";

const RESOURCE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const JOB_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const JOB_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("validateBlueprintTierReferencesAgainstWorld", () => {
  it("returns no issues when payload is empty", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld({}, []);

    expect(issues).toHaveLength(0);
  });

  it("returns no issues when all construction cost resources are valid", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        constructionCostsJson: [
          { resourceId: RESOURCE_A },
          { resourceId: RESOURCE_B },
        ],
      },
      [{ id: RESOURCE_A }, { id: RESOURCE_B }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown construction cost resource", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      { constructionCostsJson: [{ resourceId: RESOURCE_A }] },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("constructionCostsJson");
    expect(issues[0].message).toContain(RESOURCE_A);
  });

  it("returns no issues when all upkeep cost resources are valid", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      { upkeepCostsJson: [{ resourceId: RESOURCE_A }] },
      [{ id: RESOURCE_A }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown upkeep cost resource", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      { upkeepCostsJson: [{ resourceId: RESOURCE_B }] },
      [{ id: RESOURCE_A }],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("upkeepCostsJson");
    expect(issues[0].message).toContain(RESOURCE_B);
  });

  it("returns no issues for a valid passive_resource_production effect", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          {
            amount: 5,
            resourceId: RESOURCE_A,
            type: "passive_resource_production",
          },
        ],
      },
      [{ id: RESOURCE_A }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown resource in passive_resource_production", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          {
            amount: 5,
            resourceId: RESOURCE_A,
            type: "passive_resource_production",
          },
        ],
      },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("effectsJson");
    expect(issues[0].message).toContain(RESOURCE_A);
  });

  it("returns no issues for a valid resource_storage_increase effect", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          {
            amount: 100,
            resourceId: RESOURCE_B,
            type: "resource_storage_increase",
          },
        ],
      },
      [{ id: RESOURCE_B }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown resource in resource_storage_increase", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          {
            amount: 100,
            resourceId: RESOURCE_B,
            type: "resource_storage_increase",
          },
        ],
      },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("effectsJson");
    expect(issues[0].message).toContain(RESOURCE_B);
  });

  it("returns no issues for a valid job_capacity_increase effect", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          { amount: 5, jobId: JOB_A, type: "job_capacity_increase" },
        ],
      },
      [],
      [{ id: JOB_A }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown job in job_capacity_increase", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          { amount: 5, jobId: JOB_A, type: "job_capacity_increase" },
        ],
      },
      [],
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("effectsJson");
    expect(issues[0].message).toContain(JOB_A);
  });

  it("returns no issues for population_cap_increase (no references required)", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [{ amount: 50, type: "population_cap_increase" }],
      },
      [],
      [],
    );

    expect(issues).toHaveLength(0);
  });

  it("defaults activeJobs to empty array when not provided", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        effectsJson: [
          { amount: 5, jobId: JOB_B, type: "job_capacity_increase" },
        ],
      },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("effectsJson");
    expect(issues[0].message).toContain(JOB_B);
  });

  it("accumulates multiple issues across all reference types", () => {
    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        constructionCostsJson: [
          { resourceId: RESOURCE_A },
          { resourceId: RESOURCE_B },
        ],
        effectsJson: [
          {
            amount: 5,
            resourceId: RESOURCE_A,
            type: "passive_resource_production",
          },
          { amount: 3, jobId: JOB_A, type: "job_capacity_increase" },
        ],
        upkeepCostsJson: [{ resourceId: RESOURCE_B }],
      },
      [],
      [],
    );

    expect(issues).toHaveLength(5);

    const fields = issues.map((i) => i.field);
    expect(fields.filter((f) => f === "constructionCostsJson")).toHaveLength(2);
    expect(fields.filter((f) => f === "upkeepCostsJson")).toHaveLength(1);
    expect(fields.filter((f) => f === "effectsJson")).toHaveLength(2);
  });

  it("uses activeResources for both cost and effect resource checks", () => {
    const resources = [{ id: RESOURCE_A }, { id: RESOURCE_B }];

    const issues = validateBlueprintTierReferencesAgainstWorld(
      {
        constructionCostsJson: [{ resourceId: RESOURCE_A }],
        effectsJson: [
          {
            amount: 10,
            resourceId: RESOURCE_B,
            type: "resource_storage_increase",
          },
        ],
        upkeepCostsJson: [{ resourceId: RESOURCE_A }],
      },
      resources,
      [],
    );

    expect(issues).toHaveLength(0);
  });
});
