import { describe, expect, it } from "vitest";

import { formatOfficeTypesLabel } from "./officeTypesLabel";

describe("formatOfficeTypesLabel", () => {
  it("formats a single office type", () => {
    expect(formatOfficeTypesLabel("treasurer")).toBe("Treasurer");
  });

  it("formats a comma-separated list of office types", () => {
    expect(formatOfficeTypesLabel("senator,treasurer")).toBe(
      "Senator, Treasurer",
    );
  });

  it("trims whitespace around each office type", () => {
    expect(formatOfficeTypesLabel("senator, treasurer")).toBe(
      "Senator, Treasurer",
    );
  });
});
