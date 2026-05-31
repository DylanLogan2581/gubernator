import { describe, expect, it } from "vitest";

import { parseJobType } from "./parseJobType";

describe("parseJobType", () => {
  it.each([
    "construction",
    "culling",
    "deposit",
    "husbandry",
    "standard",
    "trader",
  ])("returns '%s' for the known value", (value) => {
    expect(parseJobType(value)).toBe(value);
  });

  it("throws for an unknown value", () => {
    expect(() => parseJobType("unknown_type")).toThrow(
      'Unknown job_type from database: "unknown_type"',
    );
  });

  it("throws for an empty string", () => {
    expect(() => parseJobType("")).toThrow(
      'Unknown job_type from database: ""',
    );
  });
});
