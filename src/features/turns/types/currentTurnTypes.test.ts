import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  TurnCalendarDate,
  WorldCalendarConfig,
} from "@/features/calendar";
import type {
  CurrentTurnDateDisplay,
  CurrentTurnDateDisplayLabels,
} from "@/features/turns";

type SimulationResultField = Extract<
  keyof CurrentTurnDateDisplay,
  "simulationResult" | "simulationResults"
>;

const calendarConfig = {
  weekdays: [{ index: 0, name: "Moonday" }],
  months: [{ index: 0, name: "Frostmonth", dayCount: 30 }],
  startingMonthIndex: 0,
  startingDayOfMonth: 1,
  startingYear: 1,
  startingWeekdayOffset: 0,
  dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
} satisfies WorldCalendarConfig;

const computedDate = {
  turnNumber: 7,
  year: 1,
  monthIndex: 0,
  monthName: "Frostmonth",
  dayOfMonth: 7,
  weekdayIndex: 0,
  weekdayName: "Moonday",
} satisfies TurnCalendarDate;

const displayLabels = {
  compactDateLabel: "Moonday, Frostmonth 7, Year 1",
  dateLabel: "Moonday, Frostmonth 7, Year 1",
  turnLabel: "Turn 7",
  yearLabel: "1",
} satisfies CurrentTurnDateDisplayLabels;

describe("CurrentTurnDateDisplay", () => {
  it("supports current turn and date display data without simulation results", () => {
    const currentTurnDateDisplay = {
      worldId: "world-1",
      currentTurnNumber: 7,
      calendarConfig,
      computedDate,
      displayLabels,
    } satisfies CurrentTurnDateDisplay;

    expect(currentTurnDateDisplay).toMatchObject({
      worldId: "world-1",
      currentTurnNumber: 7,
      displayLabels: {
        turnLabel: "Turn 7",
      },
    });
    expect("simulationResult" in currentTurnDateDisplay).toBe(false);
    expect("simulationResults" in currentTurnDateDisplay).toBe(false);
    expectTypeOf(
      currentTurnDateDisplay,
    ).toMatchTypeOf<CurrentTurnDateDisplay>();
    expectTypeOf<SimulationResultField>().toEqualTypeOf<never>();
  });
});
