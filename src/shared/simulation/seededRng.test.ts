import { describe, expect, it } from "vitest";

import {
  createSeededRng,
  hashStringToSeed,
  mulberry32,
  pickDeterministic,
} from "./seededRng.ts";

describe("mulberry32", () => {
  it("produces deterministic sequences from the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it("produces different sequences for different seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
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
    expect(hashStringToSeed("turn-abc")).toBe(hashStringToSeed("turn-abc"));
  });

  it("returns different seeds for different inputs", () => {
    expect(hashStringToSeed("turn-abc")).not.toBe(hashStringToSeed("turn-abd"));
  });

  it("returns a non-negative integer", () => {
    const seed = hashStringToSeed("some-uuid-string");
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });
});

describe("createSeededRng", () => {
  it("accepts a numeric seed and is deterministic", () => {
    const a = createSeededRng(7);
    const b = createSeededRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("accepts a string seed and is deterministic", () => {
    const a = createSeededRng("turn-transition-id-1");
    const b = createSeededRng("turn-transition-id-1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("returns values in [0, 1)", () => {
    const rng = createSeededRng("test");
    expect(rng()).toBeGreaterThanOrEqual(0);
    expect(rng()).toBeLessThan(1);
  });
});

describe("pickDeterministic", () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  it("returns the requested count of items", () => {
    const rng = createSeededRng(1);
    const result = pickDeterministic(rng, items, 3);
    expect(result).toHaveLength(3);
  });

  it("is deterministic — same rng state produces same picks", () => {
    const picks1 = pickDeterministic(createSeededRng(99), items, 5);
    const picks2 = pickDeterministic(createSeededRng(99), items, 5);
    expect(picks1).toEqual(picks2);
  });

  it("picks only items from the original list", () => {
    const rng = createSeededRng("uuid-seed");
    const result = pickDeterministic(rng, items, 7);
    for (const item of result) {
      expect(items).toContain(item);
    }
  });

  it("does not repeat items within a single pick", () => {
    const rng = createSeededRng("no-repeats");
    const result = pickDeterministic(rng, items, items.length);
    expect(new Set(result).size).toBe(items.length);
  });

  it("throws when count exceeds items.length", () => {
    const rng = createSeededRng(0);
    expect(() => pickDeterministic(rng, items, items.length + 1)).toThrow(
      RangeError,
    );
  });

  it("returns all items when count equals items.length", () => {
    const result = pickDeterministic(createSeededRng(5), items, items.length);
    expect(new Set(result)).toEqual(new Set(items));
  });

  it("distribution sanity — each item appears ~10% of the time in 1000 single draws", () => {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(item, 0);
    for (let run = 0; run < 1000; run += 1) {
      const rng = createSeededRng(run);
      const [picked] = pickDeterministic(rng, items, 1);
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBeGreaterThanOrEqual(80);
      expect(count).toBeLessThanOrEqual(120);
    }
  });
});
