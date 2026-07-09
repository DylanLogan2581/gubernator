import { describe, expect, it } from "vitest";

import { zipPassedAmendmentsToVersions } from "./zipPassedAmendmentsToVersions";

import type { LawAmendment } from "../types/lawAmendmentTypes";

function amendment(
  id: string,
  status: LawAmendment["status"],
  resolvedTurnNumber: number | null,
): LawAmendment {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    deadlineTurnNumber: null,
    documentId: "document-1",
    id,
    operations: [],
    proposedByCitizenId: "citizen-1",
    proposedTurnNumber: 1,
    rationaleMarkdown: null,
    resolvedTurnNumber,
    status,
    title: `Amendment ${id}`,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("zipPassedAmendmentsToVersions", () => {
  it("zips passed amendments to versions 2..N in resolution order", () => {
    const amendments = [
      amendment("a1", "passed", 5),
      amendment("a2", "passed", 2),
      amendment("a3", "withdrawn", null),
    ];
    const versions = [{ version: 1 }, { version: 2 }, { version: 3 }];

    const links = zipPassedAmendmentsToVersions(amendments, versions);

    expect(links.get("a2")).toBe(2);
    expect(links.get("a1")).toBe(3);
    expect(links.has("a3")).toBe(false);
  });

  it("ignores non-passed amendments and version 1", () => {
    const amendments = [
      amendment("a1", "failed", 3),
      amendment("a2", "expired", 4),
    ];
    const versions = [{ version: 1 }];

    const links = zipPassedAmendmentsToVersions(amendments, versions);

    expect(links.size).toBe(0);
  });

  it("leaves a passed amendment unlinked when no matching version exists", () => {
    const amendments = [amendment("a1", "passed", 1)];
    const versions = [{ version: 1 }];

    const links = zipPassedAmendmentsToVersions(amendments, versions);

    expect(links.size).toBe(0);
  });
});
