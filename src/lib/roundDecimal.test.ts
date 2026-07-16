import { describe, expect, it } from "vitest";

import { roundDecimal } from "./roundDecimal";

describe("roundDecimal", () => {
  it("rounds away floating-point addition artifacts by default", () => {
    expect(roundDecimal(0.1 + 0.0001)).toBe(0.1001);
  });

  it("rounds to a custom digit count", () => {
    expect(roundDecimal(1.23456, 2)).toBe(1.23);
  });
});
