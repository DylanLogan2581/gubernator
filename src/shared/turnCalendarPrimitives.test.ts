import { describe, it, expect } from "vitest";

import {
  calendarDateToTurnNumber,
  formatRelativeTurnDifference,
  getRelativeTurnDifference,
  type RelativeTurnDifference,
  type TurnCalendarConfig,
} from "./turnCalendarPrimitives";

// Standard calendar for testing: 12 months, 7-day week
const standardConfig: TurnCalendarConfig = {
  dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
  months: [
    { index: 0, name: "January", dayCount: 31 },
    { index: 1, name: "February", dayCount: 28 },
    { index: 2, name: "March", dayCount: 31 },
    { index: 3, name: "April", dayCount: 30 },
    { index: 4, name: "May", dayCount: 31 },
    { index: 5, name: "June", dayCount: 30 },
    { index: 6, name: "July", dayCount: 31 },
    { index: 7, name: "August", dayCount: 31 },
    { index: 8, name: "September", dayCount: 30 },
    { index: 9, name: "October", dayCount: 31 },
    { index: 10, name: "November", dayCount: 30 },
    { index: 11, name: "December", dayCount: 31 },
  ],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 0,
  weekdays: [
    { index: 0, name: "Sunday" },
    { index: 1, name: "Monday" },
    { index: 2, name: "Tuesday" },
    { index: 3, name: "Wednesday" },
    { index: 4, name: "Thursday" },
    { index: 5, name: "Friday" },
    { index: 6, name: "Saturday" },
  ],
};

// Variable-length month calendar for testing edge cases
const variableConfig: TurnCalendarConfig = {
  dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
  months: [
    { index: 0, name: "Short", dayCount: 20 },
    { index: 1, name: "Medium", dayCount: 25 },
    { index: 2, name: "Long", dayCount: 40 },
  ],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 0,
  weekdays: [
    { index: 0, name: "Day1" },
    { index: 1, name: "Day2" },
    { index: 2, name: "Day3" },
  ],
};

describe("getRelativeTurnDifference", () => {
  it("returns isToday=true when turns are equal", () => {
    const diff = getRelativeTurnDifference(standardConfig, 100, 100);
    expect(diff.isToday).toBe(true);
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(0);
    expect(diff.isPast).toBe(false);
  });

  it("returns isPast=true for past dates", () => {
    const diff = getRelativeTurnDifference(standardConfig, 500, 100);
    expect(diff.isPast).toBe(true);
    expect(diff.isToday).toBe(false);
  });

  it("returns isPast=false for future dates", () => {
    const diff = getRelativeTurnDifference(standardConfig, 100, 500);
    expect(diff.isPast).toBe(false);
    expect(diff.isToday).toBe(false);
  });

  it("counts 1 day difference correctly", () => {
    // Turn 1 = Jan 1, Year 0; Turn 2 = Jan 2, Year 0
    const diff = getRelativeTurnDifference(standardConfig, 1, 2);
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(1);
  });

  it("counts days within a month correctly", () => {
    // 10 days difference
    const diff = getRelativeTurnDifference(standardConfig, 1, 11);
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(10);
  });

  it("counts 1 month difference correctly", () => {
    // Jan 1 to Feb 1 = 1 month
    // Turn 1 = Jan 1; Turn 32 = Feb 1 (Jan has 31 days)
    const diff = getRelativeTurnDifference(standardConfig, 1, 32);
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(1);
    expect(diff.days).toBe(0);
  });

  it("counts 1 year difference correctly", () => {
    // Jan 1, Year 0 to Jan 1, Year 1 = 365 days = 1 year (for standard calendar)
    // Year 0 has 365 days
    const daysPer365Year =
      31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + 30 + 31; // 365
    const year1Start = daysPer365Year + 1; // First turn of year 1
    const diff = getRelativeTurnDifference(standardConfig, 1, year1Start);
    expect(diff.years).toBe(1);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(0);
  });

  it("handles month boundary with day clamping", () => {
    // March 31 to April 30: only 30 days in April, so clamped
    // Need to find the turn for March 31
    const march31Turn = calendarDateToTurnNumber(standardConfig, {
      year: 0,
      monthIndex: 2,
      dayOfMonth: 31,
    });
    const april30Turn = calendarDateToTurnNumber(standardConfig, {
      year: 0,
      monthIndex: 3,
      dayOfMonth: 30,
    });
    const diff = getRelativeTurnDifference(
      standardConfig,
      march31Turn,
      april30Turn,
    );
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(1);
  });

  it("handles variable month lengths in difference calculation", () => {
    // variableConfig: Short(20), Medium(25), Long(40)
    // Short 20 to Medium 25: 1 month + 5 days
    // (Short day 20 -> Medium day 20 is 1 month, then Medium day 20-25 is 5 days)
    const short20Turn = calendarDateToTurnNumber(variableConfig, {
      year: 0,
      monthIndex: 0,
      dayOfMonth: 20,
    });
    const med25Turn = calendarDateToTurnNumber(variableConfig, {
      year: 0,
      monthIndex: 1,
      dayOfMonth: 25,
    });
    const diff = getRelativeTurnDifference(
      variableConfig,
      short20Turn,
      med25Turn,
    );
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(1);
    expect(diff.days).toBe(5);
  });

  it("wraps year boundary correctly", () => {
    // Last day of year 0 to first day of year 1
    // Need Dec 31, Year 0
    const dec31Turn = calendarDateToTurnNumber(standardConfig, {
      year: 0,
      monthIndex: 11,
      dayOfMonth: 31,
    });
    const jan1Year1Turn = calendarDateToTurnNumber(standardConfig, {
      year: 1,
      monthIndex: 0,
      dayOfMonth: 1,
    });
    const diff = getRelativeTurnDifference(
      standardConfig,
      dec31Turn,
      jan1Year1Turn,
    );
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(1);
  });

  it("counts complex differences (years, months, days)", () => {
    // Create a date 1 year, 2 months, 5 days in the future
    const startTurn = calendarDateToTurnNumber(standardConfig, {
      year: 0,
      monthIndex: 0,
      dayOfMonth: 1,
    });
    // Jan 1 -> add 1 year -> Jan 1, Year 1
    // -> add 2 months -> Mar 1, Year 1
    // -> add 5 days -> Mar 6, Year 1
    const endTurn = calendarDateToTurnNumber(standardConfig, {
      year: 1,
      monthIndex: 2,
      dayOfMonth: 6,
    });
    const diff = getRelativeTurnDifference(standardConfig, startTurn, endTurn);
    expect(diff.years).toBe(1);
    expect(diff.months).toBe(2);
    expect(diff.days).toBe(5);
  });

  it("handles leap-year-like edge cases with variable calendars", () => {
    // Check that day of month is properly clamped when switching between different month lengths
    // Short(20), Medium(25), Long(40)
    // Short 20 + 1 month = Medium, day clamped to 20
    const short20Turn = calendarDateToTurnNumber(variableConfig, {
      year: 0,
      monthIndex: 0,
      dayOfMonth: 20,
    });
    const medium20Turn = calendarDateToTurnNumber(variableConfig, {
      year: 0,
      monthIndex: 1,
      dayOfMonth: 20,
    });
    const diff = getRelativeTurnDifference(
      variableConfig,
      short20Turn,
      medium20Turn,
    );
    expect(diff.months).toBe(1);
    expect(diff.years).toBe(0);
  });
});

describe("formatRelativeTurnDifference", () => {
  it("formats today", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 0,
      days: 0,
      isToday: true,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("Today");
  });

  it("formats single day in future", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 0,
      days: 1,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("One day from today");
  });

  it("formats multiple days in future", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 0,
      days: 5,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("5 days from today");
  });

  it("formats single month in future", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 1,
      days: 0,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("One month from today");
  });

  it("formats multiple months in future", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 3,
      days: 0,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("3 months from today");
  });

  it("formats single year in future", () => {
    const diff: RelativeTurnDifference = {
      years: 1,
      months: 0,
      days: 0,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("One year from today");
  });

  it("formats multiple years in future", () => {
    const diff: RelativeTurnDifference = {
      years: 2,
      months: 0,
      days: 0,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("2 years from today");
  });

  it("formats year and month in future", () => {
    const diff: RelativeTurnDifference = {
      years: 1,
      months: 2,
      days: 0,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe(
      "One year and 2 months from today",
    );
  });

  it("formats year, month, and days in future", () => {
    const diff: RelativeTurnDifference = {
      years: 1,
      months: 2,
      days: 5,
      isToday: false,
      isPast: false,
    };
    expect(formatRelativeTurnDifference(diff)).toBe(
      "One year, 2 months, and 5 days from today",
    );
  });

  it("formats single day in past", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 0,
      days: 1,
      isToday: false,
      isPast: true,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("One day ago");
  });

  it("formats multiple days in past", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 0,
      days: 3,
      isToday: false,
      isPast: true,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("3 days ago");
  });

  it("formats month and days in past", () => {
    const diff: RelativeTurnDifference = {
      years: 0,
      months: 1,
      days: 2,
      isToday: false,
      isPast: true,
    };
    expect(formatRelativeTurnDifference(diff)).toBe("One month and 2 days ago");
  });

  it("formats year, months, and days in past", () => {
    const diff: RelativeTurnDifference = {
      years: 1,
      months: 2,
      days: 3,
      isToday: false,
      isPast: true,
    };
    expect(formatRelativeTurnDifference(diff)).toBe(
      "One year, 2 months, and 3 days ago",
    );
  });
});
