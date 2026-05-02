import { describe, expect, it } from "vitest";

import { resolveTurnCalendarDate } from "./turnCalendarDates";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";

const calendarConfig = {
  weekdays: [
    { index: 0, name: "Moonday" },
    { index: 1, name: "Toilsday" },
    { index: 2, name: "Windsday" },
  ],
  months: [
    { index: 0, name: "Frostmonth", dayCount: 2 },
    { index: 1, name: "Rainmonth", dayCount: 3 },
    { index: 2, name: "Sunmonth", dayCount: 4 },
  ],
  startingMonthIndex: 0,
  startingDayOfMonth: 1,
  startingYear: 12,
  startingWeekdayOffset: 1,
  yearFormatTemplate: "Year {n}",
} satisfies WorldCalendarConfig;

describe("resolveTurnCalendarDate", () => {
  it("maps turn 1 to the configured starting date", () => {
    expect(resolveTurnCalendarDate(calendarConfig, 1)).toEqual({
      turnNumber: 1,
      year: 12,
      monthIndex: 0,
      monthName: "Frostmonth",
      dayOfMonth: 1,
      weekdayIndex: 1,
      weekdayName: "Toilsday",
    });
  });

  it("rolls over to the next configured month", () => {
    expect(resolveTurnCalendarDate(calendarConfig, 3)).toMatchObject({
      year: 12,
      monthIndex: 1,
      monthName: "Rainmonth",
      dayOfMonth: 1,
    });
  });

  it("rolls over to the next year after total configured days per year", () => {
    expect(resolveTurnCalendarDate(calendarConfig, 10)).toMatchObject({
      year: 13,
      monthIndex: 0,
      monthName: "Frostmonth",
      dayOfMonth: 1,
    });
  });

  it("rolls over weekdays from the configured starting weekday offset", () => {
    expect(resolveTurnCalendarDate(calendarConfig, 3)).toMatchObject({
      weekdayIndex: 0,
      weekdayName: "Moonday",
    });
  });

  it("supports starting from a later month and day", () => {
    expect(
      resolveTurnCalendarDate(
        {
          ...calendarConfig,
          startingMonthIndex: 1,
          startingDayOfMonth: 2,
        },
        3,
      ),
    ).toMatchObject({
      year: 12,
      monthIndex: 2,
      monthName: "Sunmonth",
      dayOfMonth: 1,
    });
  });

  it("supports negative starting years", () => {
    expect(
      resolveTurnCalendarDate(
        {
          ...calendarConfig,
          startingYear: -1,
        },
        10,
      ),
    ).toMatchObject({
      year: 0,
      monthIndex: 0,
      dayOfMonth: 1,
    });
  });

  it("supports zero starting years", () => {
    expect(
      resolveTurnCalendarDate(
        {
          ...calendarConfig,
          startingYear: 0,
        },
        10,
      ),
    ).toMatchObject({
      year: 1,
      monthIndex: 0,
      dayOfMonth: 1,
    });
  });

  it("rejects non-positive turn numbers", () => {
    expect(() => resolveTurnCalendarDate(calendarConfig, 0)).toThrow(
      RangeError,
    );
  });
});
