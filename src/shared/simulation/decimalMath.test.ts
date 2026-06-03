import { describe, expect, it } from "vitest";

import {
  addDecimal,
  clampDecimal,
  clampToRange,
  divideDecimal,
  multiplyDecimal,
  proportionalShare,
  scaleDeficit,
  subtractDecimal,
  toDecimal,
} from "./decimalMath.ts";

describe("proportionalShare", () => {
  it("returns empty array for empty weights", () => {
    expect(proportionalShare(100, [])).toEqual([]);
  });

  it("splits evenly across equal weights", () => {
    const result = proportionalShare(90, [1, 1, 1]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(30, 10);
    expect(result[1]).toBeCloseTo(30, 10);
    expect(result[2]).toBeCloseTo(30, 10);
  });

  it("distributes proportionally for unequal weights", () => {
    // weights [1, 3] → 25 % and 75 %
    const result = proportionalShare(100, [1, 3]);
    expect(result[0]).toBeCloseTo(25, 10);
    expect(result[1]).toBeCloseTo(75, 10);
  });

  it("assigns 0 to zero-weight entries", () => {
    const result = proportionalShare(60, [0, 2, 1]);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(40, 10);
    expect(result[2]).toBeCloseTo(20, 10);
  });

  it("returns all zeros when every weight is zero", () => {
    const result = proportionalShare(100, [0, 0, 0]);
    expect(result).toEqual([0, 0, 0]);
  });

  it("handles a single non-zero weight", () => {
    const result = proportionalShare(42, [7]);
    expect(result[0]).toBe(42);
  });

  it("handles amount = 0", () => {
    const result = proportionalShare(0, [1, 2, 3]);
    expect(result).toEqual([0, 0, 0]);
  });

  describe("sum-preserving property", () => {
    function sum(xs: readonly number[]): number {
      return xs.reduce((a, b) => a + b, 0);
    }

    it("preserves sum for even split", () => {
      const amount = 100;
      expect(sum(proportionalShare(amount, [1, 1, 1, 1]))).toBe(amount);
    });

    it("preserves sum for weighted split", () => {
      const amount = 999;
      expect(sum(proportionalShare(amount, [3, 7, 11]))).toBe(amount);
    });

    it("preserves sum with a zero-weight entry", () => {
      const amount = 50;
      expect(sum(proportionalShare(amount, [0, 3, 2]))).toBe(amount);
    });

    it("preserves sum for fractional amount", () => {
      const amount = 1 / 3;
      expect(sum(proportionalShare(amount, [1, 2]))).toBe(amount);
    });

    it("preserves sum for large values", () => {
      const amount = 1_000_000;
      expect(sum(proportionalShare(amount, [1, 2, 3, 4, 5, 6, 7]))).toBe(
        amount,
      );
    });
  });
});

describe("scaleDeficit", () => {
  it("returns 1.0 when available meets required exactly", () => {
    expect(scaleDeficit(10, 10)).toBe(1.0);
  });

  it("returns 1.0 when available exceeds required", () => {
    expect(scaleDeficit(10, 20)).toBe(1.0);
  });

  it("returns the ratio when available is less than required", () => {
    expect(scaleDeficit(100, 75)).toBeCloseTo(0.75, 10);
  });

  it("returns 0 when available is 0 and required is positive", () => {
    expect(scaleDeficit(50, 0)).toBe(0);
  });

  it("returns 0 when available is negative (clamp lower bound)", () => {
    expect(scaleDeficit(50, -10)).toBe(0);
  });

  it("returns 1.0 when required is 0 (nothing needed)", () => {
    expect(scaleDeficit(0, 0)).toBe(1.0);
  });

  it("returns 1.0 when required is negative", () => {
    expect(scaleDeficit(-5, 0)).toBe(1.0);
  });

  it("result is always in [0, 1]", () => {
    const cases: [number, number][] = [
      [100, 50],
      [1, 0],
      [0, 5],
      [10, 10],
      [10, 15],
    ];
    for (const [req, avail] of cases) {
      const result = scaleDeficit(req, avail);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

describe("clampToRange", () => {
  it("returns value when within range", () => {
    expect(clampToRange(5, 0, 10)).toBe(5);
  });

  it("clamps to min when below range", () => {
    expect(clampToRange(-3, 0, 10)).toBe(0);
  });

  it("clamps to max when above range", () => {
    expect(clampToRange(15, 0, 10)).toBe(10);
  });

  it("returns min when value equals min", () => {
    expect(clampToRange(0, 0, 10)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clampToRange(10, 0, 10)).toBe(10);
  });

  it("handles fractional bounds", () => {
    expect(clampToRange(0.5, 0.1, 0.9)).toBeCloseTo(0.5, 10);
    expect(clampToRange(0.05, 0.1, 0.9)).toBeCloseTo(0.1, 10);
    expect(clampToRange(0.95, 0.1, 0.9)).toBeCloseTo(0.9, 10);
  });
});

describe("toDecimal", () => {
  it("returns the value unchanged", () => {
    expect(toDecimal(42)).toBe(42);
    expect(toDecimal(0)).toBe(0);
    expect(toDecimal(-7.5)).toBe(-7.5);
  });
});

describe("addDecimal", () => {
  it("adds two values", () => {
    expect(addDecimal(3, 4)).toBe(7);
    expect(addDecimal(0.1, 0.2)).toBeCloseTo(0.3, 10);
    expect(addDecimal(-5, 5)).toBe(0);
  });
});

describe("subtractDecimal", () => {
  it("subtracts b from a", () => {
    expect(subtractDecimal(10, 4)).toBe(6);
    expect(subtractDecimal(0, 5)).toBe(-5);
    expect(subtractDecimal(3.5, 1.5)).toBeCloseTo(2, 10);
  });
});

describe("multiplyDecimal", () => {
  it("multiplies two values", () => {
    expect(multiplyDecimal(3, 4)).toBe(12);
    expect(multiplyDecimal(0.5, 6)).toBe(3);
    expect(multiplyDecimal(-2, 7)).toBe(-14);
  });
});

describe("divideDecimal", () => {
  it("divides a by b", () => {
    expect(divideDecimal(10, 2)).toBe(5);
    expect(divideDecimal(1, 3)).toBeCloseTo(1 / 3, 10);
  });

  it("throws RangeError when b is zero", () => {
    expect(() => divideDecimal(5, 0)).toThrow(RangeError);
    expect(() => divideDecimal(5, 0)).toThrow("Division by zero.");
  });
});

describe("clampDecimal", () => {
  it("returns value when within range", () => {
    expect(clampDecimal(5, 0, 10)).toBe(5);
  });

  it("clamps to min when below range", () => {
    expect(clampDecimal(-3, 0, 10)).toBe(0);
  });

  it("clamps to max when above range", () => {
    expect(clampDecimal(15, 0, 10)).toBe(10);
  });
});
