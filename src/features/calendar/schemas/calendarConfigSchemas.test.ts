import { describe, expect, it } from "vitest";

import { worldCalendarConfigSchema } from "./calendarConfigSchemas";

const validCalendarConfig = {
  weekdays: [
    { index: 0, name: "Moonday" },
    { index: 1, name: "Toilsday" },
    { index: 2, name: "Windsday" },
  ],
  months: [
    { index: 0, name: "Frostmonth", dayCount: 30 },
    { index: 1, name: "Rainmonth", dayCount: 28 },
  ],
  startingMonthIndex: 0,
  startingDayOfMonth: 1,
  startingYear: -10,
  startingWeekdayOffset: 0,
  dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
};

describe("worldCalendarConfigSchema", () => {
  it("accepts a valid world calendar config", () => {
    const result = worldCalendarConfigSchema.safeParse(validCalendarConfig);

    expect(result.success).toBe(true);
  });

  it("rejects empty weekdays", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      weekdays: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty months", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      months: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate weekday indexes", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      weekdays: [
        { index: 0, name: "Moonday" },
        { index: 0, name: "Toilsday" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-contiguous month indexes", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      months: [
        { index: 0, name: "Frostmonth", dayCount: 30 },
        { index: 2, name: "Rainmonth", dayCount: 28 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a starting month index outside the month list", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      startingMonthIndex: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a starting day beyond the selected month", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      startingDayOfMonth: 31,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a starting weekday offset outside the weekday list", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      startingWeekdayOffset: 3,
    });

    expect(result.success).toBe(false);
  });

  it("rejects date format templates without a date token", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      dateFormatTemplate: "Year",
    });

    expect(result.success).toBe(false);
  });

  it("rejects date format templates with unsupported tokens", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      dateFormatTemplate: "{month} {era}",
    });

    expect(result.success).toBe(false);
  });

  it("maps the old year template field to the default full date shape", () => {
    const { dateFormatTemplate: _dateFormatTemplate, ...oldConfig } =
      validCalendarConfig;
    const result = worldCalendarConfigSchema.safeParse({
      ...oldConfig,
      yearFormatTemplate: "Age {n}",
    });

    expect(result).toMatchObject({
      data: {
        dateFormatTemplate: "{weekday}, {month} {day}, Age {year}",
      },
      success: true,
    });
  });

  it("rejects extra keys at every schema level", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      weekdays: [{ index: 0, name: "Moonday", shortName: "Moon" }],
    });

    expect(result.success).toBe(false);
  });
});
