import { describe, expect, it } from "vitest";

import { createSeededRng, hashStringToSeed, mulberry32 } from "./seededRng";

describe("mulberry32", () => {
  it("produces deterministic sequences from the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const sequenceA = [a(), a(), a(), a()];
    const sequenceB = [b(), b(), b(), b()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it("returns values in the [0, 1) interval", () => {
    const rng = mulberry32(123);
    for (let index = 0; index < 1000; index += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hashStringToSeed", () => {
  it("returns the same seed for the same input", () => {
    expect(hashStringToSeed("citizen-abc")).toBe(
      hashStringToSeed("citizen-abc"),
    );
  });

  it("returns different seeds for different inputs", () => {
    expect(hashStringToSeed("citizen-abc")).not.toBe(
      hashStringToSeed("citizen-abd"),
    );
  });
});

describe("createSeededRng", () => {
  it("accepts a numeric seed", () => {
    const rng = createSeededRng(7);
    expect(typeof rng()).toBe("number");
  });

  it("accepts a string seed and is deterministic", () => {
    const a = createSeededRng("npc-1");
    const b = createSeededRng("npc-1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
