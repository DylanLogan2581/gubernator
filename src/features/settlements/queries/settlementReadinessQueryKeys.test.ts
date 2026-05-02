import { describe, expect, it } from "vitest";

import { settlementReadinessQueryKeys } from "@/features/settlements";

describe("settlementReadinessQueryKeys", () => {
  it("centralizes settlement query key roots", () => {
    expect(settlementReadinessQueryKeys.all).toEqual(["settlements"]);
  });

  it("creates stable readiness list keys scoped by world id", () => {
    expect(settlementReadinessQueryKeys.list("world-1")).toEqual([
      "settlements",
      "readiness",
      "list",
      "world-1",
    ]);
    expect(settlementReadinessQueryKeys.list("world-1")).toEqual(
      settlementReadinessQueryKeys.list("world-1"),
    );
    expect(settlementReadinessQueryKeys.list("world-2")).toEqual([
      "settlements",
      "readiness",
      "list",
      "world-2",
    ]);
  });

  it("creates stable readiness summary keys scoped by world id", () => {
    expect(settlementReadinessQueryKeys.summary("world-1")).toEqual([
      "settlements",
      "readiness",
      "summary",
      "world-1",
    ]);
    expect(settlementReadinessQueryKeys.summary("world-1")).toEqual(
      settlementReadinessQueryKeys.summary("world-1"),
    );
    expect(settlementReadinessQueryKeys.summary("world-2")).toEqual([
      "settlements",
      "readiness",
      "summary",
      "world-2",
    ]);
  });
});
