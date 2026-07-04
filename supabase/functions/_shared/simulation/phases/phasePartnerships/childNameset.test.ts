// Unit tests for phasePartnerships/childNameset — seeded-RNG determinism plus
// parent-nameset heredity/fallback precedence.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { createSeededRng } from "../../seededRng.ts";

import { pickChildNamesetId } from "./childNameset.ts";

import type { SeededRng } from "../../seededRng.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidNamesetId(validIds: readonly string[]): (namesetId: string) => boolean {
  return (namesetId: string): boolean => validIds.includes(namesetId);
}

function makeCallCountingRng(rng: SeededRng): { rng: SeededRng; callCount: () => number } {
  let calls = 0;
  const wrapped: SeededRng = () => {
    calls += 1;
    return rng();
  };
  return { callCount: () => calls, rng: wrapped };
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("pickChildNamesetId — determinism", () => {
  it("same seed + same inputs produce the same nameset choice", () => {
    const isValid = isValidNamesetId(["nsA", "nsB"]);

    const result1 = pickChildNamesetId(
      createSeededRng("same-nameset-seed"),
      "nsA",
      "nsB",
      isValid,
      null,
    );
    const result2 = pickChildNamesetId(
      createSeededRng("same-nameset-seed"),
      "nsA",
      "nsB",
      isValid,
      null,
    );

    expect(result1).toBe("nsA");
    expect(result1).toBe(result2);
  });

  it("different seeds can produce a different outcome when both parents are valid", () => {
    // Verified offline: "nameset-seed-1" rolls < 0.5 (picks A),
    // "nameset-seed-2" rolls >= 0.5 (picks B) for this exact call sequence.
    const isValid = isValidNamesetId(["nsA", "nsB"]);

    const resultA = pickChildNamesetId(
      createSeededRng("nameset-seed-1"),
      "nsA",
      "nsB",
      isValid,
      null,
    );
    const resultB = pickChildNamesetId(
      createSeededRng("nameset-seed-2"),
      "nsA",
      "nsB",
      isValid,
      null,
    );

    expect(resultA).toBe("nsA");
    expect(resultB).toBe("nsB");
    expect(resultA).not.toBe(resultB);
  });
});

// ---------------------------------------------------------------------------
// Precedence / fallback
// ---------------------------------------------------------------------------

describe("pickChildNamesetId — parent precedence and fallback", () => {
  it("picks between both valid parent namesets via the rng (50/50)", () => {
    const isValid = isValidNamesetId(["nsA", "nsB"]);
    const result = pickChildNamesetId(
      createSeededRng("nameset-seed-1"),
      "nsA",
      "nsB",
      isValid,
      "fallback-ns",
    );

    expect(["nsA", "nsB"]).toContain(result);
  });

  it("uses parent A's nameset without consulting rng when only A is valid", () => {
    const isValid = isValidNamesetId(["nsA"]);
    const { callCount, rng } = makeCallCountingRng(createSeededRng("unused-seed"));

    const result = pickChildNamesetId(rng, "nsA", "nsB-invalid", isValid, null);

    expect(result).toBe("nsA");
    expect(callCount()).toBe(0);
  });

  it("uses parent B's nameset without consulting rng when only B is valid", () => {
    const isValid = isValidNamesetId(["nsB"]);
    const { callCount, rng } = makeCallCountingRng(createSeededRng("unused-seed"));

    const result = pickChildNamesetId(rng, "nsA-invalid", "nsB", isValid, null);

    expect(result).toBe("nsB");
    expect(callCount()).toBe(0);
  });

  it("falls back to fallbackNamesetId when neither parent nameset validates", () => {
    const isValid = isValidNamesetId(["fallback-ns"]);
    const result = pickChildNamesetId(
      createSeededRng("fallback-seed"),
      "nsA-invalid",
      "nsB-invalid",
      isValid,
      "fallback-ns",
    );

    expect(result).toBe("fallback-ns");
  });

  it("returns null when neither parent nameset validates and fallback is invalid", () => {
    const isValid = isValidNamesetId(["fallback-ns"]);
    const result = pickChildNamesetId(
      createSeededRng("fallback-seed"),
      "nsA-invalid",
      "nsB-invalid",
      isValid,
      "not-the-valid-one",
    );

    expect(result).toBeNull();
  });

  it("returns null when neither parent nameset validates and fallback is null", () => {
    const isValid = isValidNamesetId(["fallback-ns"]);
    const result = pickChildNamesetId(
      createSeededRng("fallback-seed"),
      null,
      null,
      isValid,
      null,
    );

    expect(result).toBeNull();
  });

  it("treats a null parent nameset as invalid without throwing", () => {
    const isValid = isValidNamesetId(["nsB"]);
    const result = pickChildNamesetId(
      createSeededRng("null-parent-seed"),
      null,
      "nsB",
      isValid,
      null,
    );

    expect(result).toBe("nsB");
  });
});
