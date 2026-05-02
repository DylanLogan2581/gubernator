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
  it("formats full display with weekday, month, day, and formatted year", () => {
    expect(
      formatCalendarDate(calendarDate, {
        displayVariant: "full",
        yearFormatTemplate: "Age {n}",
      }),
    ).toBe("Highday, Suncrest 7, Age 42");
  });

  it("formats compact display without weekday", () => {
    expect(
      formatCalendarDate(calendarDate, {
        displayVariant: "compact",
        yearFormatTemplate: "Age {n}",
      }),
    ).toBe("Suncrest 7, Age 42");
  });

  it("formats zero years from computed calendar date data", () => {
    expect(
      formatCalendarDate(
        {
          ...calendarDate,
          year: 0,
        },
        {
          displayVariant: "full",
          yearFormatTemplate: "Year {n}",
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
          displayVariant: "compact",
          yearFormatTemplate: "{n} BT",
        },
      ),
    ).toBe("Suncrest 7, -3 BT");
  });
});

describe("formatCalendarYear", () => {
  it("replaces every year placeholder with the computed year", () => {
    expect(formatCalendarYear(12, "{n} / Year {n}")).toBe("12 / Year 12");
  });
});
