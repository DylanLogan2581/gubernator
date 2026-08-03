import { describe, expect, it } from "vitest";

import {
  clampConfidence,
  computeNextFiatConfidence,
  computeResourceBackedConfidence,
  isFiatConfidenceCollapsing,
  isResourceBackedInDefault,
} from "@/shared/economy";

describe("clampConfidence", () => {
  it("clamps to [0, 1]", () => {
    expect(clampConfidence(-0.5)).toBe(0);
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(0.42)).toBe(0.42);
  });
});

describe("computeNextFiatConfidence", () => {
  it("penalizes supply growth beyond the 5%/turn threshold", () => {
    const confidence = computeNextFiatConfidence({
      burnedThisTurn: 0,
      confidence: 1,
      mintedThisTurn: 200,
      moneySupplyStart: 800,
    });
    expect(confidence).toBeCloseTo(0.92);
  });

  it("recovers by 0.02/turn when supply is stable", () => {
    const confidence = computeNextFiatConfidence({
      burnedThisTurn: 0,
      confidence: 0.5,
      mintedThisTurn: 0,
      moneySupplyStart: 1000,
    });
    expect(confidence).toBeCloseTo(0.52);
  });
});

describe("isFiatConfidenceCollapsing", () => {
  it("is true below 0.25 and false at/above it", () => {
    expect(isFiatConfidenceCollapsing(0.24)).toBe(true);
    expect(isFiatConfidenceCollapsing(0.25)).toBe(false);
  });
});

describe("resource-backed default", () => {
  it("defaults when money supply exceeds reserve * backing ratio", () => {
    expect(
      isResourceBackedInDefault({
        backingRatio: 1,
        moneySupply: 100,
        reserveQuantity: 50,
      }),
    ).toBe(true);
    expect(
      computeResourceBackedConfidence({
        backingRatio: 1,
        moneySupply: 100,
        reserveQuantity: 50,
      }),
    ).toBe(0);
  });

  it("stays out of default and clamps overcollateralized health to 1", () => {
    expect(
      isResourceBackedInDefault({
        backingRatio: 1,
        moneySupply: 50,
        reserveQuantity: 100,
      }),
    ).toBe(false);
    expect(
      computeResourceBackedConfidence({
        backingRatio: 1,
        moneySupply: 50,
        reserveQuantity: 100,
      }),
    ).toBe(1);
  });
});
