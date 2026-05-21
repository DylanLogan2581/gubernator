import { describe, expect, it } from "vitest";

import {
  emptyCalendarValidationErrors,
  getCalendarValidationErrors,
  hasCalendarValidationErrors,
} from "./calendarConfigValidation";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";


function createCalendarConfig(
  overrides: Partial<WorldCalendarConfig> = {},
): WorldCalendarConfig {
  return {
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
    months: [
      { dayCount: 30, index: 0, name: "January" },
      { dayCount: 28, index: 1, name: "February" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 1,
    weekdays: [
      { index: 0, name: "Monday" },
      { index: 1, name: "Tuesday" },
    ],
    ...overrides,
  };
}

describe("getCalendarValidationErrors", () => {
  it("returns no errors for a valid config", () => {
    expect(getCalendarValidationErrors(createCalendarConfig())).toEqual({});
  });

  it("returns a weekdays error when weekdays is empty", () => {
    const config = createCalendarConfig({ weekdays: [] as never });
    const errors = getCalendarValidationErrors(config);
    expect(errors.weekdays).toBe("Add at least one weekday.");
  });

  it("returns a months error when months is empty", () => {
    const config = createCalendarConfig({ months: [] as never });
    const errors = getCalendarValidationErrors(config);
    expect(errors.months).toBe("Add at least one month.");
  });

  it("returns a startingDayOfMonth error when day exceeds month length", () => {
    const config = createCalendarConfig({ startingDayOfMonth: 31 });
    const errors = getCalendarValidationErrors(config);
    expect(errors.startingDayOfMonth).toBe(
      "Starting day must fit within the starting month.",
    );
  });

  it("returns a startingDayOfMonth error when day is less than 1", () => {
    const config = createCalendarConfig({ startingDayOfMonth: 0 });
    const errors = getCalendarValidationErrors(config);
    expect(errors.startingDayOfMonth).toBe(
      "Starting day must fit within the starting month.",
    );
  });

  it("returns a startingWeekdayOffset error when offset is out of bounds", () => {
    const config = createCalendarConfig({ startingWeekdayOffset: 5 });
    const errors = getCalendarValidationErrors(config);
    expect(errors.startingWeekdayOffset).toBe(
      "Starting weekday offset must match an existing weekday.",
    );
  });

  it("returns a dateFormatTemplate error when template is blank", () => {
    const config = createCalendarConfig({ dateFormatTemplate: "   " });
    const errors = getCalendarValidationErrors(config);
    expect(errors.dateFormatTemplate).toBe("Date format template is required.");
  });

  it("returns a dateFormatTemplate error when template has no date tokens", () => {
    const config = createCalendarConfig({ dateFormatTemplate: "Year One" });
    const errors = getCalendarValidationErrors(config);
    expect(errors.dateFormatTemplate).toBe(
      "Date format template must include at least one date token.",
    );
  });

  it("returns a dateFormatTemplate error when template has an unsupported token", () => {
    const config = createCalendarConfig({
      dateFormatTemplate: "{weekday} {era}",
    });
    const errors = getCalendarValidationErrors(config);
    expect(errors.dateFormatTemplate).toBe(
      "Date format template contains an unsupported token.",
    );
  });
});

describe("hasCalendarValidationErrors", () => {
  it("returns false for empty errors", () => {
    expect(hasCalendarValidationErrors(emptyCalendarValidationErrors)).toBe(
      false,
    );
  });

  it("returns true when months has an error", () => {
    expect(
      hasCalendarValidationErrors({ months: "Add at least one month." }),
    ).toBe(true);
  });

  it("returns true when weekdays has an error", () => {
    expect(
      hasCalendarValidationErrors({ weekdays: "Add at least one weekday." }),
    ).toBe(true);
  });

  it("returns true when startingDayOfMonth has an error", () => {
    expect(
      hasCalendarValidationErrors({
        startingDayOfMonth: "Starting day must fit within the starting month.",
      }),
    ).toBe(true);
  });

  it("returns true when startingWeekdayOffset has an error", () => {
    expect(
      hasCalendarValidationErrors({
        startingWeekdayOffset:
          "Starting weekday offset must match an existing weekday.",
      }),
    ).toBe(true);
  });

  it("returns true when dateFormatTemplate has an error", () => {
    expect(
      hasCalendarValidationErrors({
        dateFormatTemplate: "Date format template is required.",
      }),
    ).toBe(true);
  });
});
