import { describe, expect, it } from "vitest";

import { deriveSettlementForecastWarnings } from "./settlementForecastWarnings";

import type { SettlementForecastData } from "../schemas/forecastSchemas";

function createForecast(
  overrides: Partial<SettlementForecastData> = {},
): SettlementForecastData {
  return {
    settlementId: "settlement-1",
    resourceDeltas: [],
    deathsBy: { starvation: 0, homelessness: 0, other: 0 },
    completedProjects: [],
    buildingUpkeepFailures: [],
    tradeChanges: [],
    ...overrides,
  };
}

describe("deriveSettlementForecastWarnings", () => {
  it("returns no warnings for a clean forecast", () => {
    expect(deriveSettlementForecastWarnings(createForecast())).toEqual([]);
  });

  it("warns about starvation deaths with correct pluralization", () => {
    const warnings = deriveSettlementForecastWarnings(
      createForecast({
        deathsBy: { starvation: 1, homelessness: 0, other: 0 },
      }),
    );
    expect(warnings).toEqual([
      { key: "deaths-starvation", label: "1 citizen will starve this turn" },
    ]);
  });

  it("warns about homelessness and other deaths pluralized for multiple", () => {
    const warnings = deriveSettlementForecastWarnings(
      createForecast({
        deathsBy: { starvation: 0, homelessness: 2, other: 3 },
      }),
    );
    expect(warnings).toEqual([
      {
        key: "deaths-homelessness",
        label: "2 citizens will die from homelessness this turn",
      },
      { key: "deaths-other", label: "3 citizen deaths expected this turn" },
    ]);
  });

  it("warns about each building upkeep failure", () => {
    const warnings = deriveSettlementForecastWarnings(
      createForecast({ buildingUpkeepFailures: ["building-1", "building-2"] }),
    );
    expect(warnings).toEqual([
      { key: "upkeep-building-1", label: "Building upkeep failed: building-1" },
      { key: "upkeep-building-2", label: "Building upkeep failed: building-2" },
    ]);
  });

  it("warns about paused trade routes, mapping the pause reason to its label", () => {
    const warnings = deriveSettlementForecastWarnings(
      createForecast({
        tradeChanges: [
          {
            tradeRouteId: "route-1",
            delivered: false,
            pauseReason: "insufficient_trader_origin",
            quantityTransferred: 0,
          },
          {
            tradeRouteId: "route-2",
            delivered: false,
            pauseReason: null,
            quantityTransferred: 0,
          },
          {
            tradeRouteId: "route-3",
            delivered: true,
            pauseReason: null,
            quantityTransferred: 10,
          },
        ],
      }),
    );
    expect(warnings).toEqual([
      {
        key: "trade-route-1",
        label: "Trade route paused — Insufficient traders at origin",
      },
      { key: "trade-route-2", label: "Trade route paused" },
    ]);
  });

  it("falls back to the raw pause reason when no label exists", () => {
    const warnings = deriveSettlementForecastWarnings(
      createForecast({
        tradeChanges: [
          {
            tradeRouteId: "route-1",
            delivered: false,
            pauseReason: "unmapped_reason",
            quantityTransferred: 0,
          },
        ],
      }),
    );
    expect(warnings).toEqual([
      { key: "trade-route-1", label: "Trade route paused — unmapped_reason" },
    ]);
  });
});
