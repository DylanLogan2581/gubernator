import { describe, expect, it } from "vitest";

import { formatDate } from "./formatDate";

describe("formatDate", () => {
  it("formats an ISO timestamp as a human-readable date", () => {
    expect(formatDate("2024-01-05T12:34:56.000Z")).toBe("Jan 5, 2024");
  });

  it("formats a date-only ISO string", () => {
    expect(formatDate("2023-12-31")).toBe("Dec 31, 2023");
  });

  it("returns the original string when it cannot be parsed", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
