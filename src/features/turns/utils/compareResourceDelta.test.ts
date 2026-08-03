import { describe, expect, it } from "vitest";

import type { TurnTransitionResourceSnapshot } from "@/features/turns";

import { compareResourceDelta } from "./compareResourceDelta";

function makeActualSnapshot(
  overrides: Partial<TurnTransitionResourceSnapshot> = {},
): TurnTransitionResourceSnapshot {
  return {
    consumedAmount: 0,
    id: "snapshot-1",
    producedAmount: 0,
    quantityAfter: 100,
    quantityBefore: 90,
    resourceId: "resource-1",
    settlementId: "settlement-1",
    tradeInAmount: 0,
    tradeOutAmount: 0,
    turnNumber: 1,
    worldId: "world-1",
    ...overrides,
  };
}

describe("compareResourceDelta", () => {
  it("does not flag divergence when forecast and actual match exactly", () => {
    const result = compareResourceDelta(
      { netDelta: 10 },
      makeActualSnapshot({ quantityBefore: 90, quantityAfter: 100 }),
    );

    expect(result.diverged).toBe(false);
  });

  it("does not flag divergence for a difference within tolerance", () => {
    const result = compareResourceDelta(
      { netDelta: 10 },
      makeActualSnapshot({ quantityBefore: 90, quantityAfter: 100.005 }),
    );

    expect(result.diverged).toBe(false);
  });

  it("flags divergence for a difference just outside tolerance", () => {
    const result = compareResourceDelta(
      { netDelta: 10 },
      makeActualSnapshot({ quantityBefore: 90, quantityAfter: 100.02 }),
    );

    expect(result.diverged).toBe(true);
  });

  it("flags divergence for a meaningfully different actual value", () => {
    const result = compareResourceDelta(
      { netDelta: 10 },
      makeActualSnapshot({ quantityBefore: 90, quantityAfter: 105 }),
    );

    expect(result.diverged).toBe(true);
  });
});
