import { describe, expect, it } from "vitest";

import { parseTradeRouteLegDirection } from "./parseTradeRouteLegDirection";

describe("parseTradeRouteLegDirection", () => {
  it.each(["receive", "send"])("returns '%s' for the known value", (value) => {
    expect(parseTradeRouteLegDirection(value)).toBe(value);
  });

  it("throws for an unknown value", () => {
    expect(() => parseTradeRouteLegDirection("unknown_direction")).toThrow(
      'Unknown trade route leg direction from database: "unknown_direction"',
    );
  });

  it("throws for an empty string", () => {
    expect(() => parseTradeRouteLegDirection("")).toThrow(
      'Unknown trade route leg direction from database: ""',
    );
  });
});
