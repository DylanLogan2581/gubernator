import { describe, expect, it } from "vitest";

import { formatSettlementReadyTimestamp } from "./settlementReadyTimestampFormatting";

describe("formatSettlementReadyTimestamp", () => {
  it("formats a valid ISO timestamp into a localized date-time string", () => {
    expect(formatSettlementReadyTimestamp("2025-06-15T12:00:00Z")).toBe(
      "6/15/25, 12:00 PM",
    );
  });

  it("returns the raw string unchanged when given a non-ISO input", () => {
    expect(formatSettlementReadyTimestamp("not-a-date")).toBe("not-a-date");
  });
});
