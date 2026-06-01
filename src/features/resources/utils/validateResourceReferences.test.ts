import { describe, expect, it } from "vitest";

import { validateResourceReferencesAgainstWorld } from "./validateResourceReferences";

describe("validateResourceReferencesAgainstWorld", () => {
  it("returns no issues when payload is empty", () => {
    const issues = validateResourceReferencesAgainstWorld({});

    expect(issues).toHaveLength(0);
  });

  it("returns an array", () => {
    const issues = validateResourceReferencesAgainstWorld({});

    expect(Array.isArray(issues)).toBe(true);
  });
});
