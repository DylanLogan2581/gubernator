import { describe, expect, it } from "vitest";

import {
  computeSettlementReadinessSummary,
  formatSettlementReadinessPercentage,
} from "./settlementReadinessSummary";

describe("computeSettlementReadinessSummary", () => {
  it("counts auto-ready settlements as ready", () => {
    expect(
      computeSettlementReadinessSummary([
        {
          auto_ready_enabled: true,
          is_ready_current_turn: false,
        },
      ]),
    ).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 100,
      readySettlementCount: 1,
      totalSettlementCount: 1,
    });
  });

  it("counts manually ready settlements as ready", () => {
    expect(
      computeSettlementReadinessSummary([
        {
          auto_ready_enabled: false,
          is_ready_current_turn: true,
        },
      ]),
    ).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 100,
      readySettlementCount: 1,
      totalSettlementCount: 1,
    });
  });

  it("counts settlements without auto-ready or manual readiness as not ready", () => {
    expect(
      computeSettlementReadinessSummary([
        {
          auto_ready_enabled: false,
          is_ready_current_turn: false,
        },
      ]),
    ).toEqual({
      notReadySettlementCount: 1,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 1,
    });
  });

  it("summarizes mixed readiness rows", () => {
    const summary = computeSettlementReadinessSummary([
      {
        auto_ready_enabled: true,
        is_ready_current_turn: false,
      },
      {
        auto_ready_enabled: false,
        is_ready_current_turn: true,
      },
      {
        auto_ready_enabled: false,
        is_ready_current_turn: false,
      },
    ]);

    expect(summary).toEqual({
      notReadySettlementCount: 1,
      readyPercentage: 66.66666666666666,
      readySettlementCount: 2,
      totalSettlementCount: 3,
    });
  });

  it("returns stable output for worlds without settlements", () => {
    expect(computeSettlementReadinessSummary([])).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 0,
    });
  });
});

describe("formatSettlementReadinessPercentage", () => {
  it("floors uneven ratios to whole-number display labels", () => {
    expect(formatSettlementReadinessPercentage(66.66666666666666)).toBe("66%");
  });

  it("formats zero-settlement readiness as zero percent", () => {
    expect(formatSettlementReadinessPercentage(0)).toBe("0%");
  });

  it("does not round almost-complete percentages up", () => {
    expect(formatSettlementReadinessPercentage(99.9)).toBe("99%");
  });
});
