import { describe, expect, it } from "vitest";

import { DIORAMA_SERIES, DIORAMA_TICK_INTERVAL_MS } from "./dioramaSeries";

describe("DIORAMA_SERIES", () => {
  it("is a fixed-length, deterministic sequence starting from a known frame", () => {
    expect(DIORAMA_SERIES).toHaveLength(20);
    expect(DIORAMA_SERIES[0]).toStrictEqual({
      tick: 0,
      population: 42,
      stockpile: 60,
      event: null,
    });
  });

  it("advances population monotonically each tick", () => {
    for (let i = 1; i < DIORAMA_SERIES.length; i += 1) {
      expect(DIORAMA_SERIES[i].population).toBeGreaterThan(
        DIORAMA_SERIES[i - 1].population,
      );
    }
  });

  it("surfaces events only on the documented ticks", () => {
    const eventTicks = DIORAMA_SERIES.filter((entry) => entry.event !== null);
    expect(eventTicks.map((entry) => [entry.tick, entry.event])).toStrictEqual([
      [4, "Harvest festival"],
      [12, "Trade route established"],
    ]);
  });

  it("uses a positive tick interval", () => {
    expect(DIORAMA_TICK_INTERVAL_MS).toBeGreaterThan(0);
  });
});
