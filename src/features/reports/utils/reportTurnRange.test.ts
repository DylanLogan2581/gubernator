import { describe, expect, it } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { createTurnLabelers, defaultReportTurnRange } from "./reportTurnRange";

const calendarConfig: WorldCalendarConfig = {
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

describe("defaultReportTurnRange", () => {
  it("returns a 20-turn window ending at the current turn", () => {
    expect(defaultReportTurnRange(50)).toEqual({ fromTurn: 31, toTurn: 50 });
  });

  it("clamps fromTurn to 1 near the start of the world", () => {
    expect(defaultReportTurnRange(5)).toEqual({ fromTurn: 1, toTurn: 5 });
  });

  it("clamps toTurn to 1 for a non-positive current turn", () => {
    expect(defaultReportTurnRange(0)).toEqual({ fromTurn: 1, toTurn: 1 });
  });
});

describe("createTurnLabelers", () => {
  it("falls back to T<n> labels when the calendar config is null", () => {
    const { axisLabel, turnLabel } = createTurnLabelers(null);
    expect(turnLabel(3)).toBe("T3");
    expect(axisLabel(3)).toBe("T3");
  });

  it("formats turnLabel with the long template and axisLabel with the short one", () => {
    const { axisLabel, turnLabel } = createTurnLabelers(calendarConfig);
    expect(turnLabel(1)).toContain("Sunday");
    expect(axisLabel(1)).toBe("January 1");
  });
});
