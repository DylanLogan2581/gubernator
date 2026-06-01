import { describe, expect, it } from "vitest";

import {
  checkJobLinkExpectedType,
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "./validateReferenceHelpers";

const RESOURCE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const JOB_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("checkResourceIdsInWorld", () => {
  it("pushes no issues when entries is empty", () => {
    const issues: ReferenceIssue[] = [];
    checkResourceIdsInWorld("myField", [], new Set([RESOURCE_A]), issues);
    expect(issues).toHaveLength(0);
  });

  it("pushes no issues when all entries are in the active set", () => {
    const issues: ReferenceIssue[] = [];
    checkResourceIdsInWorld(
      "myField",
      [{ resourceId: RESOURCE_A }, { resourceId: RESOURCE_B }],
      new Set([RESOURCE_A, RESOURCE_B]),
      issues,
    );
    expect(issues).toHaveLength(0);
  });

  it("pushes an issue for each entry not in the active set", () => {
    const issues: ReferenceIssue[] = [];
    checkResourceIdsInWorld(
      "myField",
      [{ resourceId: RESOURCE_A }, { resourceId: RESOURCE_B }],
      new Set<string>(),
      issues,
    );
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.field === "myField")).toBe(true);
    expect(issues[0].message).toContain(RESOURCE_A);
    expect(issues[1].message).toContain(RESOURCE_B);
  });

  it("uses the provided field name in every issue", () => {
    const issues: ReferenceIssue[] = [];
    checkResourceIdsInWorld(
      "customField",
      [{ resourceId: RESOURCE_A }],
      new Set<string>(),
      issues,
    );
    expect(issues[0].field).toBe("customField");
  });

  it("appends to an existing issues array", () => {
    const issues: ReferenceIssue[] = [
      { field: "prior", message: "pre-existing" },
    ];
    checkResourceIdsInWorld(
      "myField",
      [{ resourceId: RESOURCE_A }],
      new Set<string>(),
      issues,
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].field).toBe("prior");
  });
});

describe("checkJobLinkExpectedType", () => {
  it("pushes no issue when the job exists with the expected type", () => {
    const issues: ReferenceIssue[] = [];
    checkJobLinkExpectedType(
      "jobId",
      JOB_ID,
      [{ id: JOB_ID, jobType: "deposit" }],
      "deposit",
      issues,
    );
    expect(issues).toHaveLength(0);
  });

  it("pushes an issue when the job is not in the active list", () => {
    const issues: ReferenceIssue[] = [];
    checkJobLinkExpectedType("jobId", JOB_ID, [], "deposit", issues);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("jobId");
    expect(issues[0].message).toContain(JOB_ID);
    expect(issues[0].message).toContain("not an active job");
  });

  it("pushes an issue when the job exists but has the wrong type", () => {
    const issues: ReferenceIssue[] = [];
    checkJobLinkExpectedType(
      "jobId",
      JOB_ID,
      [{ id: JOB_ID, jobType: "standard" }],
      "deposit",
      issues,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("jobId");
    expect(issues[0].message).toContain("deposit");
  });

  it("uses the provided field name in every issue", () => {
    const issues: ReferenceIssue[] = [];
    checkJobLinkExpectedType("husbandryJobId", JOB_ID, [], "husbandry", issues);
    expect(issues[0].field).toBe("husbandryJobId");
  });

  it("appends to an existing issues array", () => {
    const issues: ReferenceIssue[] = [
      { field: "prior", message: "pre-existing" },
    ];
    checkJobLinkExpectedType("jobId", JOB_ID, [], "deposit", issues);
    expect(issues).toHaveLength(2);
    expect(issues[0].field).toBe("prior");
  });
});
