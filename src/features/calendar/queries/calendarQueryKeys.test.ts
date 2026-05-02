import { describe, expect, it } from "vitest";

import { calendarQueryKeys } from "@/features/calendar";

describe("calendarQueryKeys", () => {
  it("centralizes calendar query key roots", () => {
    expect(calendarQueryKeys.all).toEqual(["calendar"]);
  });

  it("creates stable world calendar config keys scoped by world id", () => {
    expect(calendarQueryKeys.worldCalendarConfig("world-1")).toEqual([
      "calendar",
      "world-calendar-config",
      "world-1",
    ]);
    expect(calendarQueryKeys.worldCalendarConfig("world-1")).toEqual(
      calendarQueryKeys.worldCalendarConfig("world-1"),
    );
    expect(calendarQueryKeys.worldCalendarConfig("world-2")).toEqual([
      "calendar",
      "world-calendar-config",
      "world-2",
    ]);
  });

  it("creates stable computed world date keys scoped by world id", () => {
    expect(calendarQueryKeys.computedWorldDate("world-1")).toEqual([
      "calendar",
      "computed-world-date",
      "world-1",
    ]);
    expect(calendarQueryKeys.computedWorldDate("world-1")).toEqual(
      calendarQueryKeys.computedWorldDate("world-1"),
    );
    expect(calendarQueryKeys.computedWorldDate("world-2")).toEqual([
      "calendar",
      "computed-world-date",
      "world-2",
    ]);
  });
});
