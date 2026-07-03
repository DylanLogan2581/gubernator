import { describe, expect, it } from "vitest";

import { settlementForecastQueryKeys } from "@/features/settlements";

describe("settlementForecastQueryKeys", () => {
  it("centralizes forecast query key root", () => {
    expect(settlementForecastQueryKeys.all).toEqual(["forecast"]);
  });

  it("creates stable forecast keys scoped by world id", () => {
    expect(settlementForecastQueryKeys.byWorld("world-1")).toEqual([
      "forecast",
      "world",
      "world-1",
    ]);
    expect(settlementForecastQueryKeys.byWorld("world-1")).toEqual(
      settlementForecastQueryKeys.byWorld("world-1"),
    );
    expect(settlementForecastQueryKeys.byWorld("world-2")).toEqual([
      "forecast",
      "world",
      "world-2",
    ]);
  });
});
