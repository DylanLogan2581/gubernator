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
  yearFormatTemplate: "Year {n}",
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

  it("rejects year format templates without the year token", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      yearFormatTemplate: "Year",
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra keys at every schema level", () => {
    const result = worldCalendarConfigSchema.safeParse({
      ...validCalendarConfig,
      weekdays: [{ index: 0, name: "Moonday", shortName: "Moon" }],
    });

    expect(result.success).toBe(false);
  });
});
