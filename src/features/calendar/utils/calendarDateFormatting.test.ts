import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatCalendarYear,
} from "./calendarDateFormatting";

import type { TurnCalendarDate } from "./turnCalendarDates";

const calendarDate = {
  turnNumber: 1,
  year: 42,
  monthIndex: 2,
  monthName: "Suncrest",
  dayOfMonth: 7,
  weekdayIndex: 4,
  weekdayName: "Highday",
} satisfies TurnCalendarDate;

describe("formatCalendarDate", () => {
  it("formats a template with weekday, month, day, and year", () => {
    expect(
      formatCalendarDate(calendarDate, {
        dateFormatTemplate: "{weekday}, {month} {day}, Age {year}",
      }),
    ).toBe("Highday, Suncrest 7, Age 42");
  });

  it("allows admins to omit date parts", () => {
    expect(
      formatCalendarDate(calendarDate, {
        dateFormatTemplate: "{month} {year}",
      }),
    ).toBe("Suncrest 42");
  });

  it("allows admins to reorder date parts and punctuation", () => {
    expect(
      formatCalendarDate(calendarDate, {
        dateFormatTemplate: "{year} // {day} {month} // {weekday}",
      }),
    ).toBe("42 // 7 Suncrest // Highday");
  });

  it("formats zero years from computed calendar date data", () => {
    expect(
      formatCalendarDate(
        {
          ...calendarDate,
          year: 0,
        },
        {
          dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
        },
      ),
    ).toBe("Highday, Suncrest 7, Year 0");
  });

  it("formats negative years from computed calendar date data", () => {
    expect(
      formatCalendarDate(
        {
          ...calendarDate,
          year: -3,
        },
        {
          dateFormatTemplate: "{month} {day}, {year} BT",
        },
      ),
    ).toBe("Suncrest 7, -3 BT");
  });
});

describe("formatCalendarYear", () => {
  it("formats the computed numeric year by itself", () => {
    expect(formatCalendarYear(12)).toBe("12");
  });
});
