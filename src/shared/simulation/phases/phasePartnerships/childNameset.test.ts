import { describe, expect, it } from "vitest";

import { mulberry32 } from "../../seededRng.ts";

import { pickChildNamesetId } from "./childNameset.ts";

const VALID = new Set(["ns-a", "ns-b", "ns-fallback"]);
const isValid = (id: string): boolean => VALID.has(id);

describe("pickChildNamesetId", () => {
  it("picks each parent's nameset roughly 50/50 when both are valid", () => {
    const seen = new Set<string | null>();
    for (let seed = 0; seed < 64; seed++) {
      seen.add(
        pickChildNamesetId(mulberry32(seed), "ns-a", "ns-b", isValid, null),
      );
    }
    expect(seen).toEqual(new Set(["ns-a", "ns-b"]));
  });

  it("is deterministic for the same rng seed", () => {
    const a = pickChildNamesetId(mulberry32(7), "ns-a", "ns-b", isValid, null);
    const b = pickChildNamesetId(mulberry32(7), "ns-a", "ns-b", isValid, null);
    expect(a).toBe(b);
  });

  it("returns the same nameset without consuming randomness when both parents share it", () => {
    for (let seed = 0; seed < 8; seed++) {
      expect(
        pickChildNamesetId(mulberry32(seed), "ns-a", "ns-a", isValid, null),
      ).toBe("ns-a");
    }
  });

  it("uses parent A's nameset when parent B has none", () => {
    expect(pickChildNamesetId(mulberry32(1), "ns-a", null, isValid, null)).toBe(
      "ns-a",
    );
  });

  it("uses parent B's nameset when parent A has none", () => {
    expect(pickChildNamesetId(mulberry32(1), null, "ns-b", isValid, null)).toBe(
      "ns-b",
    );
  });

  it("skips an invalid parent nameset in favor of the other parent", () => {
    for (let seed = 0; seed < 8; seed++) {
      expect(
        pickChildNamesetId(
          mulberry32(seed),
          "ns-deleted",
          "ns-b",
          isValid,
          null,
        ),
      ).toBe("ns-b");
    }
  });

  it("falls back to the location nameset when neither parent nameset is valid", () => {
    expect(
      pickChildNamesetId(
        mulberry32(1),
        "ns-deleted",
        "ns-trashed",
        isValid,
        "ns-fallback",
      ),
    ).toBe("ns-fallback");
  });

  it("falls back to the location nameset when neither parent has a nameset", () => {
    expect(
      pickChildNamesetId(mulberry32(1), null, null, isValid, "ns-fallback"),
    ).toBe("ns-fallback");
  });

  it("returns null when parents and fallback are all invalid or missing", () => {
    expect(
      pickChildNamesetId(mulberry32(1), "ns-deleted", null, isValid, null),
    ).toBeNull();
    expect(
      pickChildNamesetId(mulberry32(1), null, null, isValid, "ns-also-deleted"),
    ).toBeNull();
  });

  it("does not use the fallback when a parent nameset is valid", () => {
    expect(
      pickChildNamesetId(mulberry32(1), "ns-a", null, isValid, "ns-fallback"),
    ).toBe("ns-a");
  });
});
