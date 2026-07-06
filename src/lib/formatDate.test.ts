import { describe, expect, it } from "vitest";

import { formatDate, formatRelativeTime } from "./formatDate";

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

describe("formatRelativeTime", () => {
  const now = new Date("2024-06-15T00:00:00.000Z");

  it("formats a past timestamp in days", () => {
    expect(formatRelativeTime("2024-06-13T00:00:00.000Z", now)).toBe(
      "2 days ago",
    );
  });

  it("formats a past timestamp in months", () => {
    expect(formatRelativeTime("2024-03-15T00:00:00.000Z", now)).toBe(
      "3 months ago",
    );
  });

  it("formats a recent timestamp as just now", () => {
    expect(formatRelativeTime("2024-06-14T23:59:45.000Z", now)).toBe(
      "this minute",
    );
  });

  it("returns the original string when it cannot be parsed", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("not-a-date");
  });
});
