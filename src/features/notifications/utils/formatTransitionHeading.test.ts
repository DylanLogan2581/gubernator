import { describe, expect, it } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { formatTransitionHeading } from "./formatTransitionHeading";

const CALENDAR_CONFIG: WorldCalendarConfig = {
  dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
  shortDateFormatTemplate: "{month} {day}",
  months: [
    { index: 0, name: "January", dayCount: 31 },
    { index: 1, name: "February", dayCount: 28 },
  ],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 0,
  weekdays: [
    { index: 0, name: "Sunday" },
    { index: 1, name: "Monday" },
  ],
};

describe("formatTransitionHeading", () => {
  it("returns General for the untransitioned bucket", () => {
    expect(
      formatTransitionHeading(
        {
          transitionId: null,
          toTurnNumber: null,
          finishedAt: null,
          startedAt: null,
        },
        CALENDAR_CONFIG,
      ),
    ).toBe("General");
  });

  it("uses the calendar config to render a short in-world date", () => {
    const heading = formatTransitionHeading(
      {
        transitionId: "transition-1",
        toTurnNumber: 2,
        finishedAt: "2026-05-03T12:00:00.000Z",
        startedAt: "2026-05-03T11:00:00.000Z",
      },
      CALENDAR_CONFIG,
    );

    expect(heading).toBe("Turn 2 · January 2");
  });

  it("falls back to the real-world finished date when no calendar config is loaded", () => {
    const heading = formatTransitionHeading(
      {
        transitionId: "transition-1",
        toTurnNumber: 2,
        finishedAt: "2026-05-03T12:00:00.000Z",
        startedAt: "2026-05-03T11:00:00.000Z",
      },
      null,
    );

    expect(heading).toBe("Turn 2 · May 3, 2026");
  });

  it("falls back to the started date when finishedAt is null", () => {
    const heading = formatTransitionHeading(
      {
        transitionId: "transition-1",
        toTurnNumber: 2,
        finishedAt: null,
        startedAt: "2026-05-03T11:00:00.000Z",
      },
      null,
    );

    expect(heading).toBe("Turn 2 · May 3, 2026");
  });
});
