import { describe, expect, it } from "vitest";

import { formatElapsed, getTurnPhaseLabel } from "./turnPhaseLabels";

describe("getTurnPhaseLabel", () => {
  it("labels worker stages", () => {
    expect(getTurnPhaseLabel("queued")).toBe("Queued");
    expect(getTurnPhaseLabel("loading")).toBe("Loading world state");
    expect(getTurnPhaseLabel("persisting")).toBe("Saving results");
  });

  it("labels simulation phases in plain language", () => {
    expect(getTurnPhaseLabel("standard_jobs")).toBe("Working jobs");
    expect(getTurnPhaseLabel("citizen_consumption")).toBe("Feeding citizens");
    expect(getTurnPhaseLabel("logs_and_snapshots")).toBe("Recording history");
  });

  it("falls back for an unknown or absent stage", () => {
    expect(getTurnPhaseLabel(null)).toBe("Advancing the turn");
  });
});

describe("formatElapsed", () => {
  it("formats as m:ss", () => {
    const startedAt = "2026-08-03T12:00:00.000Z";
    const now = Date.parse("2026-08-03T12:01:07.000Z");

    expect(formatElapsed(startedAt, now)).toBe("1:07");
  });

  it("clamps a clock skew to zero", () => {
    const startedAt = "2026-08-03T12:00:05.000Z";
    const now = Date.parse("2026-08-03T12:00:00.000Z");

    expect(formatElapsed(startedAt, now)).toBe("0:00");
  });
});
