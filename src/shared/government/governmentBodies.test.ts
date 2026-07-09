import { describe, expect, it } from "vitest";

import {
  resolveBodyMembers,
  type ResolveBodyMembersData,
} from "@/shared/government";

const BASE_DATA: ResolveBodyMembersData = {
  aliveCitizenIds: [
    "senator-1",
    "senator-2",
    "ruler-1",
    "manager-1",
    "manager-2",
    "extra-1",
  ],
  officeHolders: [
    { citizenId: "senator-1", officeTypeId: "senate-seat" },
    { citizenId: "senator-2", officeTypeId: "senate-seat" },
    { citizenId: "clergy-1", officeTypeId: "clergy-seat" },
  ],
  rulerCitizenId: "ruler-1",
  settlementManagerCitizenIds: ["manager-1", "manager-2"],
};

describe("resolveBodyMembers", () => {
  it("resolves office_type to every holder of that office", () => {
    expect(
      resolveBodyMembers(
        { composition: [{ kind: "office_type", officeTypeId: "senate-seat" }] },
        BASE_DATA,
      ),
    ).toEqual(expect.arrayContaining(["senator-1", "senator-2"]));
  });

  it("excludes holders of a different office", () => {
    const members = resolveBodyMembers(
      { composition: [{ kind: "office_type", officeTypeId: "senate-seat" }] },
      BASE_DATA,
    );
    expect(members).not.toContain("clergy-1");
  });

  it("resolves citizens to the explicit list", () => {
    expect(
      resolveBodyMembers(
        {
          composition: [
            { kind: "citizens", citizenIds: ["extra-1", "ruler-1"] },
          ],
        },
        BASE_DATA,
      ),
    ).toEqual(expect.arrayContaining(["extra-1", "ruler-1"]));
  });

  it("resolves ruler to the ruler citizen id", () => {
    expect(
      resolveBodyMembers({ composition: [{ kind: "ruler" }] }, BASE_DATA),
    ).toEqual(["ruler-1"]);
  });

  it("resolves ruler to empty when unfilled", () => {
    expect(
      resolveBodyMembers(
        { composition: [{ kind: "ruler" }] },
        { ...BASE_DATA, rulerCitizenId: null },
      ),
    ).toEqual([]);
  });

  it("resolves settlement_managers to every settlement manager", () => {
    expect(
      resolveBodyMembers(
        { composition: [{ kind: "settlement_managers" }] },
        BASE_DATA,
      ),
    ).toEqual(expect.arrayContaining(["manager-1", "manager-2"]));
  });

  it("dedupes citizens matched by multiple rules", () => {
    const members = resolveBodyMembers(
      {
        composition: [
          { kind: "ruler" },
          { kind: "citizens", citizenIds: ["ruler-1"] },
        ],
      },
      BASE_DATA,
    );
    expect(members).toEqual(["ruler-1"]);
  });

  it("excludes dead citizens even when matched by a rule", () => {
    const members = resolveBodyMembers(
      {
        composition: [{ kind: "citizens", citizenIds: ["dead-1", "extra-1"] }],
      },
      { ...BASE_DATA, aliveCitizenIds: ["extra-1"] },
    );
    expect(members).toEqual(["extra-1"]);
  });

  it("unions members across multiple rule kinds", () => {
    const members = resolveBodyMembers(
      {
        composition: [
          { kind: "office_type", officeTypeId: "senate-seat" },
          { kind: "ruler" },
          { kind: "settlement_managers" },
        ],
      },
      BASE_DATA,
    );
    expect([...members].sort()).toEqual(
      ["manager-1", "manager-2", "ruler-1", "senator-1", "senator-2"].sort(),
    );
  });

  it("accepts aliveCitizenIds as a Set", () => {
    expect(
      resolveBodyMembers(
        { composition: [{ kind: "ruler" }] },
        { ...BASE_DATA, aliveCitizenIds: new Set(["ruler-1"]) },
      ),
    ).toEqual(["ruler-1"]);
  });
});
