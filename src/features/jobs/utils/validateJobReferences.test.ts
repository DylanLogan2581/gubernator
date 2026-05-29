import { describe, expect, it } from "vitest";

import { validateJobReferencesAgainstWorld } from "./validateJobReferences";

const RESOURCE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DEPOSIT_TYPE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MANAGED_POP_TYPE_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("validateJobReferencesAgainstWorld", () => {
  it("returns no issues when payload is empty", () => {
    const issues = validateJobReferencesAgainstWorld({}, []);

    expect(issues).toHaveLength(0);
  });

  it("returns no issues when all input resources are valid", () => {
    const issues = validateJobReferencesAgainstWorld(
      { inputsJson: [{ resourceId: RESOURCE_A }, { resourceId: RESOURCE_B }] },
      [{ id: RESOURCE_A }, { id: RESOURCE_B }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns no issues when all output resources are valid", () => {
    const issues = validateJobReferencesAgainstWorld(
      { outputsJson: [{ resourceId: RESOURCE_A }] },
      [{ id: RESOURCE_A }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown input resource", () => {
    const issues = validateJobReferencesAgainstWorld(
      { inputsJson: [{ resourceId: RESOURCE_A }] },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("inputsJson");
    expect(issues[0].message).toContain(RESOURCE_A);
  });

  it("returns an issue for an unknown output resource", () => {
    const issues = validateJobReferencesAgainstWorld(
      { outputsJson: [{ resourceId: RESOURCE_B }] },
      [{ id: RESOURCE_A }],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("outputsJson");
  });

  it("returns an issue for an unknown linked deposit type", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedDepositTypeId: DEPOSIT_TYPE_ID },
      [],
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("linkedDepositTypeId");
    expect(issues[0].message).toContain(DEPOSIT_TYPE_ID);
  });

  it("returns no issue for a valid linked deposit type", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedDepositTypeId: DEPOSIT_TYPE_ID },
      [],
      [{ id: DEPOSIT_TYPE_ID }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns an issue for an unknown linked managed population type", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedManagedPopulationTypeId: MANAGED_POP_TYPE_ID },
      [],
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("linkedManagedPopulationTypeId");
    expect(issues[0].message).toContain(MANAGED_POP_TYPE_ID);
  });

  it("returns no issue for a valid linked managed population type", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedManagedPopulationTypeId: MANAGED_POP_TYPE_ID },
      [],
      [{ id: MANAGED_POP_TYPE_ID }],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns no issue when linkedDepositTypeId is null", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedDepositTypeId: null },
      [],
      [],
    );

    expect(issues).toHaveLength(0);
  });

  it("returns no issue when linkedManagedPopulationTypeId is null", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedManagedPopulationTypeId: null },
      [],
      [],
    );

    expect(issues).toHaveLength(0);
  });

  it("accumulates multiple issues across all reference types", () => {
    const issues = validateJobReferencesAgainstWorld(
      {
        inputsJson: [
          { resourceId: "bad-resource-1" },
          { resourceId: "bad-resource-2" },
        ],
        linkedDepositTypeId: DEPOSIT_TYPE_ID,
        outputsJson: [{ resourceId: "bad-resource-3" }],
      },
      [],
      [],
    );

    expect(issues).toHaveLength(4);

    const fields = issues.map((i) => i.field);
    expect(fields.filter((f) => f === "inputsJson")).toHaveLength(2);
    expect(fields.filter((f) => f === "outputsJson")).toHaveLength(1);
    expect(fields.filter((f) => f === "linkedDepositTypeId")).toHaveLength(1);
  });

  it("uses the linkedTypes list for both deposit and managed population checks", () => {
    const sharedList = [{ id: DEPOSIT_TYPE_ID }, { id: MANAGED_POP_TYPE_ID }];

    const issues = validateJobReferencesAgainstWorld(
      {
        linkedDepositTypeId: DEPOSIT_TYPE_ID,
        linkedManagedPopulationTypeId: MANAGED_POP_TYPE_ID,
      },
      [],
      sharedList,
    );

    expect(issues).toHaveLength(0);
  });

  it("defaults linkedTypes to an empty array when not provided", () => {
    const issues = validateJobReferencesAgainstWorld(
      { linkedDepositTypeId: DEPOSIT_TYPE_ID },
      [],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("linkedDepositTypeId");
  });
});
