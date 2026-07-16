import { describe, expect, it } from "vitest";

import { validateDepositTypeReferencesAgainstWorld } from "./validateDepositTypeReferences";

const RESOURCE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const JOB_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const JOB_ID_2 = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("validateDepositTypeReferencesAgainstWorld", () => {
  it("returns no issues when payload is empty", () => {
    const issues = validateDepositTypeReferencesAgainstWorld({}, []);

    expect(issues).toHaveLength(0);
  });

  it("returns no issues when payload has no jobs", () => {
    const issues = validateDepositTypeReferencesAgainstWorld({ jobs: [] }, []);

    expect(issues).toHaveLength(0);
  });

  it("returns no issues when all worker input resources are valid", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      {
        jobs: [
          {
            workerInputsJson: [
              { resourceId: RESOURCE_A },
              { resourceId: RESOURCE_B },
            ],
          },
        ],
      },
      [{ id: RESOURCE_A }, { id: RESOURCE_B }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown worker input resource", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      { jobs: [{ workerInputsJson: [{ resourceId: RESOURCE_A }] }] },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("workerInputsJson");
    expect(issues[0].message).toContain(RESOURCE_A);
  });

  it("accumulates issues for multiple invalid worker input resources across jobs", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      {
        jobs: [
          { workerInputsJson: [{ resourceId: RESOURCE_A }] },
          { workerInputsJson: [{ resourceId: RESOURCE_B }] },
        ],
      },
      [],
    );

    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.field === "workerInputsJson")).toBe(true);
  });

  it("returns an issue when a linked job is not in the active jobs list", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      { jobs: [{ jobId: JOB_ID }] },
      [],
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("jobId");
    expect(issues[0].message).toContain(JOB_ID);
  });

  it("returns an issue when a linked job has the wrong job type", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      { jobs: [{ jobId: JOB_ID }] },
      [],
      [{ id: JOB_ID, jobType: "standard" }],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("jobId");
    expect(issues[0].message).toContain("deposit");
  });

  it("returns no issue when a linked job has job type 'deposit'", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      { jobs: [{ jobId: JOB_ID }] },
      [],
      [{ id: JOB_ID, jobType: "deposit" }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns no issue when jobId is null", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      { jobs: [{ jobId: null }] },
      [],
      [],
    );

    expect(issues).toHaveLength(0);
  });

  it("defaults activeJobs to an empty array when not provided", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      { jobs: [{ jobId: JOB_ID }] },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("jobId");
  });

  it("accumulates issues across worker inputs and job references for multiple jobs", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      {
        jobs: [
          {
            jobId: JOB_ID,
            workerInputsJson: [
              { resourceId: RESOURCE_A },
              { resourceId: RESOURCE_B },
            ],
          },
          { jobId: JOB_ID_2 },
        ],
      },
      [],
      [],
    );

    expect(issues).toHaveLength(4);
    const fields = issues.map((i) => i.field);
    expect(fields.filter((f) => f === "workerInputsJson")).toHaveLength(2);
    expect(fields.filter((f) => f === "jobId")).toHaveLength(2);
  });

  it("returns no issues when both resources and jobs are valid", () => {
    const issues = validateDepositTypeReferencesAgainstWorld(
      {
        jobs: [
          {
            jobId: JOB_ID,
            workerInputsJson: [{ resourceId: RESOURCE_A }],
          },
        ],
      },
      [{ id: RESOURCE_A }],
      [{ id: JOB_ID, jobType: "deposit" }],
    );

    expect(issues).toHaveLength(0);
  });
});
