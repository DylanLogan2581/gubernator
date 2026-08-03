import { describe, expect, it } from "vitest";

import type { WorldGeneratedNamingConfig } from "@/lib/worldNamingConfigSchemas";

import {
  EMPTY_GENERATED_CONFIG,
  isListReferenced,
  renameListRefInPatterns,
  sanitizeGeneratedConfig,
  sanitizePartListEntries,
  validateGeneratedConfig,
} from "./GeneratedConfigUtils";

const BASE_CONFIG: WorldGeneratedNamingConfig = {
  type: "generated",
  convention: "pool",
  parts: { onset: ["A", "Bra"], coda: ["dan", "lin"] },
  patterns: {
    female_given: [["onset"], ["coda"]],
    male_given: [["onset"], ["coda"]],
    surname: [],
  },
};

describe("sanitizePartListEntries", () => {
  it("trims entries and drops blank lines but keeps duplicates", () => {
    expect(sanitizePartListEntries([" Ada ", "", "Ada", "  "])).toEqual([
      "Ada",
      "Ada",
    ]);
  });
});

describe("sanitizeGeneratedConfig", () => {
  it("sanitizes every part list without touching patterns/convention", () => {
    const config: WorldGeneratedNamingConfig = {
      ...BASE_CONFIG,
      parts: { onset: [" A ", "", "A"] },
    };
    expect(sanitizeGeneratedConfig(config).parts).toEqual({
      onset: ["A", "A"],
    });
  });
});

describe("validateGeneratedConfig", () => {
  it("returns no errors for a valid config", () => {
    expect(validateGeneratedConfig(BASE_CONFIG)).toEqual([]);
  });

  it("flags a pattern referencing an unknown list", () => {
    const config: WorldGeneratedNamingConfig = {
      ...BASE_CONFIG,
      patterns: { ...BASE_CONFIG.patterns, surname: [["missing"]] },
    };
    expect(validateGeneratedConfig(config)).toContain(
      "A pattern references a list that does not exist.",
    );
  });

  it("ignores blank lines mid-edit (sanitized before validating)", () => {
    const config: WorldGeneratedNamingConfig = {
      ...BASE_CONFIG,
      parts: { ...BASE_CONFIG.parts, onset: ["A", ""] },
    };
    expect(validateGeneratedConfig(config)).toEqual([]);
  });

  it("flags the empty starter config as missing required patterns is fine but reports large/invalid shapes", () => {
    expect(validateGeneratedConfig(EMPTY_GENERATED_CONFIG)).toEqual([]);
  });
});

describe("isListReferenced", () => {
  it("returns true when a pattern references the list", () => {
    expect(isListReferenced(BASE_CONFIG, "onset")).toBe(true);
  });

  it("returns false when no pattern references the list", () => {
    const config: WorldGeneratedNamingConfig = {
      ...BASE_CONFIG,
      parts: { ...BASE_CONFIG.parts, unused: ["x"] },
    };
    expect(isListReferenced(config, "unused")).toBe(false);
  });
});

describe("renameListRefInPatterns", () => {
  it("renames every list-ref group referencing the old name", () => {
    const renamed = renameListRefInPatterns(
      BASE_CONFIG.patterns,
      "onset",
      "start",
    );
    expect(renamed.female_given).toEqual([["start"], ["coda"]]);
    expect(renamed.male_given).toEqual([["start"], ["coda"]]);
  });

  it("leaves literal string elements untouched", () => {
    const patterns = {
      ...BASE_CONFIG.patterns,
      surname: ["onset", ["onset"]],
    };
    const renamed = renameListRefInPatterns(patterns, "onset", "start");
    expect(renamed.surname).toEqual(["onset", ["start"]]);
  });
});
