import { describe, expect, it } from "vitest";

import { validateManagedPopulationTypeReferencesAgainstWorld } from "./validateManagedPopulationTypeReferences";

const RESOURCE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const HUSBANDRY_JOB_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CULLING_JOB_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("validateManagedPopulationTypeReferencesAgainstWorld", () => {
  it("returns no issues when payload is empty", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld({}, []);

    expect(issues).toHaveLength(0);
  });

  it("returns no issues when all maintenance rule resources are valid", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      {
        maintenanceRulesJson: [
          { resourceId: RESOURCE_A },
          { resourceId: RESOURCE_B },
        ],
      },
      [{ id: RESOURCE_A }, { id: RESOURCE_B }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown maintenance rule resource", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { maintenanceRulesJson: [{ resourceId: RESOURCE_A }] },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("maintenanceRulesJson");
    expect(issues[0].message).toContain(RESOURCE_A);
  });

  it("returns no issues when all culling output resources are valid", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      {
        cullingOutputsJson: [{ resourceId: RESOURCE_A }],
      },
      [{ id: RESOURCE_A }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown culling output resource", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { cullingOutputsJson: [{ resourceId: RESOURCE_B }] },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("cullingOutputsJson");
    expect(issues[0].message).toContain(RESOURCE_B);
  });

  it("accumulates issues for multiple invalid resources across both fields", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      {
        cullingOutputsJson: [{ resourceId: RESOURCE_B }],
        maintenanceRulesJson: [{ resourceId: RESOURCE_A }],
      },
      [],
    );

    expect(issues).toHaveLength(2);
    const fields = issues.map((i) => i.field);
    expect(fields).toContain("maintenanceRulesJson");
    expect(fields).toContain("cullingOutputsJson");
  });

  it("returns an issue when the husbandry job is not in the active jobs list", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { husbandryJobId: HUSBANDRY_JOB_ID },
      [],
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("husbandryJobId");
    expect(issues[0].message).toContain(HUSBANDRY_JOB_ID);
  });

  it("returns an issue when the husbandry job has the wrong job type", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { husbandryJobId: HUSBANDRY_JOB_ID },
      [],
      [{ id: HUSBANDRY_JOB_ID, jobType: "culling" }],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("husbandryJobId");
    expect(issues[0].message).toContain("husbandry");
  });

  it("returns no issue when the husbandry job has job type 'husbandry'", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { husbandryJobId: HUSBANDRY_JOB_ID },
      [],
      [{ id: HUSBANDRY_JOB_ID, jobType: "husbandry" }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue when the culling job is not in the active jobs list", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { cullingJobId: CULLING_JOB_ID },
      [],
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("cullingJobId");
    expect(issues[0].message).toContain(CULLING_JOB_ID);
  });

  it("returns an issue when the culling job has the wrong job type", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { cullingJobId: CULLING_JOB_ID },
      [],
      [{ id: CULLING_JOB_ID, jobType: "husbandry" }],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("cullingJobId");
    expect(issues[0].message).toContain("culling");
  });

  it("returns no issue when the culling job has job type 'culling'", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { cullingJobId: CULLING_JOB_ID },
      [],
      [{ id: CULLING_JOB_ID, jobType: "culling" }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns no issue when husbandryJobId is null", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { husbandryJobId: null },
      [],
      [],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns no issue when cullingJobId is null", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { cullingJobId: null },
      [],
      [],
    );

    expect(issues).toHaveLength(0);
  });

  it("defaults activeJobs to an empty array when not provided", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      { husbandryJobId: HUSBANDRY_JOB_ID },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("husbandryJobId");
  });

  it("accumulates issues across resource and job reference checks", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      {
        cullingJobId: CULLING_JOB_ID,
        cullingOutputsJson: [{ resourceId: RESOURCE_B }],
        husbandryJobId: HUSBANDRY_JOB_ID,
        maintenanceRulesJson: [{ resourceId: RESOURCE_A }],
      },
      [],
      [],
    );

    expect(issues).toHaveLength(4);
    const fields = issues.map((i) => i.field);
    expect(fields.filter((f) => f === "maintenanceRulesJson")).toHaveLength(1);
    expect(fields.filter((f) => f === "cullingOutputsJson")).toHaveLength(1);
    expect(fields.filter((f) => f === "husbandryJobId")).toHaveLength(1);
    expect(fields.filter((f) => f === "cullingJobId")).toHaveLength(1);
  });

  it("returns no issues when all resources and jobs are valid", () => {
    const issues = validateManagedPopulationTypeReferencesAgainstWorld(
      {
        cullingJobId: CULLING_JOB_ID,
        cullingOutputsJson: [{ resourceId: RESOURCE_B }],
        husbandryJobId: HUSBANDRY_JOB_ID,
        maintenanceRulesJson: [{ resourceId: RESOURCE_A }],
      },
      [{ id: RESOURCE_A }, { id: RESOURCE_B }],
      [
        { id: HUSBANDRY_JOB_ID, jobType: "husbandry" },
        { id: CULLING_JOB_ID, jobType: "culling" },
      ],
    );

    expect(issues).toHaveLength(0);
  });
});
