import { describe, expect, it } from "vitest";

import { parseBulkPaste } from "./PoolEditorUtils";

describe("parseBulkPaste", () => {
  it("splits text into trimmed lines", () => {
    expect(parseBulkPaste("  alpha \nbeta\n  gamma  ", [])).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("drops blank lines", () => {
    expect(parseBulkPaste("alpha\n\nbeta\n\n", [])).toEqual(["alpha", "beta"]);
  });

  it("deduplicates within the pasted block", () => {
    expect(parseBulkPaste("alpha\nbeta\nalpha", [])).toEqual(["alpha", "beta"]);
  });

  it("drops entries already present in the existing pool", () => {
    expect(parseBulkPaste("alpha\nbeta\ngamma", ["beta"])).toEqual([
      "alpha",
      "gamma",
    ]);
  });

  it("deduplication against existing is case-sensitive", () => {
    expect(parseBulkPaste("Alpha\nalpha", ["alpha"])).toEqual(["Alpha"]);
  });

  it("returns empty array when all pasted entries are already present", () => {
    expect(parseBulkPaste("alpha\nbeta", ["alpha", "beta"])).toEqual([]);
  });

  it("returns empty array for blank input", () => {
    expect(parseBulkPaste("   \n  \n", ["alpha"])).toEqual([]);
  });
});
