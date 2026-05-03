import { describe, expect, expectTypeOf, it } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";
import type {
  BasicEndTurnReadinessRow,
  BasicEndTurnTransitionInput,
} from "@/features/turns";

type LaterSimulationInputField = Extract<
  keyof BasicEndTurnTransitionInput,
  | "assignments"
  | "buildings"
  | "citizens"
  | "events"
  | "populationSimulationState"
  | "resources"
  | "trade"
>;

type LaterSimulationReadinessField = Extract<
  keyof BasicEndTurnReadinessRow,
  | "assignments"
  | "buildings"
  | "citizens"
  | "events"
  | "populationSimulationState"
  | "resources"
  | "trade"
>;

const calendarConfig = {
  weekdays: [{ index: 0, name: "Moonday" }],
  months: [{ index: 0, name: "Frostmonth", dayCount: 30 }],
  startingMonthIndex: 0,
  startingDayOfMonth: 1,
  startingYear: 1,
  startingWeekdayOffset: 0,
  yearFormatTemplate: "Year {n}",
} satisfies WorldCalendarConfig;

describe("BasicEndTurnTransitionInput", () => {
  it("models the basic Epic 2 end-turn transition inputs", () => {
    const input = {
      actorId: "user-1",
      calendarConfig,
      expectedCurrentTurnNumber: 7,
      isWorldArchived: false,
      readinessRows: [
        {
          autoReadyEnabled: false,
          id: "settlement-1",
          isReadyCurrentTurn: true,
        },
      ],
      worldId: "world-1",
    } satisfies BasicEndTurnTransitionInput;

    expect(input).toMatchObject({
      actorId: "user-1",
      expectedCurrentTurnNumber: 7,
      isWorldArchived: false,
      worldId: "world-1",
    });
    expectTypeOf(input).toMatchTypeOf<BasicEndTurnTransitionInput>();
    expectTypeOf(
      input.readinessRows[0],
    ).toMatchTypeOf<BasicEndTurnReadinessRow>();
  });

  it("excludes later simulation domains from the transition input shape", () => {
    expectTypeOf<LaterSimulationInputField>().toEqualTypeOf<never>();
    expectTypeOf<LaterSimulationReadinessField>().toEqualTypeOf<never>();
  });
});
