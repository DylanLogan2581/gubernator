import { describe, expect, it } from "vitest";

import { parseBulkPaste, sanitizePoolEntries } from "./PoolEditorUtils";

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

describe("sanitizePoolEntries", () => {
  it("trims surrounding whitespace from entries", () => {
    expect(sanitizePoolEntries(["  alpha", "beta  ", "  gamma  "])).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(sanitizePoolEntries(["alpha", "", "beta", "   "])).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("preserves order of remaining entries", () => {
    expect(sanitizePoolEntries(["gamma", "", "alpha", "beta"])).toEqual([
      "gamma",
      "alpha",
      "beta",
    ]);
  });

  it("returns empty array when all entries are blank", () => {
    expect(sanitizePoolEntries(["", "   ", "\t"])).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(sanitizePoolEntries([])).toEqual([]);
  });
});
