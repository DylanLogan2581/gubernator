import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  TurnCalendarDate,
  WorldCalendarConfig,
} from "@/features/calendar";
import type {
  BasicEndTurnLogPayload,
  BasicEndTurnNotificationPayload,
  BasicEndTurnReadinessRow,
  BasicEndTurnReadinessSummary,
  BasicEndTurnTransitionInput,
  BasicEndTurnTransitionResult,
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

type LaterSimulationResultField = Extract<
  keyof BasicEndTurnTransitionResult,
  | "buildingOutcomes"
  | "buildings"
  | "citizenOutcomes"
  | "citizens"
  | "eventOutcomes"
  | "events"
  | "populationOutcomes"
  | "populationSimulationState"
  | "resourceOutcomes"
  | "resources"
  | "trade"
  | "tradeOutcomes"
>;

type LaterSimulationPayloadField = Extract<
  keyof BasicEndTurnLogPayload | keyof BasicEndTurnNotificationPayload,
  | "buildingOutcomes"
  | "buildings"
  | "citizenOutcomes"
  | "citizens"
  | "eventOutcomes"
  | "events"
  | "populationOutcomes"
  | "populationSimulationState"
  | "resourceOutcomes"
  | "resources"
  | "trade"
  | "tradeOutcomes"
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

const previousDate = {
  dayOfMonth: 7,
  monthIndex: 0,
  monthName: "Frostmonth",
  turnNumber: 7,
  weekdayIndex: 0,
  weekdayName: "Moonday",
  year: 1,
} satisfies TurnCalendarDate;

const nextDate = {
  dayOfMonth: 8,
  monthIndex: 0,
  monthName: "Frostmonth",
  turnNumber: 8,
  weekdayIndex: 0,
  weekdayName: "Moonday",
  year: 1,
} satisfies TurnCalendarDate;

const readinessSummary = {
  notReadySettlementCount: 1,
  readyPercentage: 50,
  readySettlementCount: 1,
  totalSettlementCount: 2,
} satisfies BasicEndTurnReadinessSummary;

describe("BasicEndTurnTransitionInput", () => {
  it("models the basic Epic 2 end-turn transition inputs", () => {
    const input = {
      actorId: "user-1",
      calendarConfig,
      currentTurnNumber: 7,
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
      currentTurnNumber: 7,
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

describe("BasicEndTurnTransitionResult", () => {
  it("models the basic Epic 2 transition output shape", () => {
    const logPayload = {
      category: "turn_transition",
      fromTurnNumber: 7,
      nextDate,
      previousDate,
      readinessSummary,
      toTurnNumber: 8,
    } satisfies BasicEndTurnLogPayload;
    const notificationPayload = {
      messageText: "Turn 8 is ready.",
      notificationType: "turn_advanced",
    } satisfies BasicEndTurnNotificationPayload;
    const result = {
      fromTurnNumber: 7,
      logPayload,
      nextDate,
      notificationPayload,
      previousDate,
      readinessSummary,
      toTurnNumber: 8,
    } satisfies BasicEndTurnTransitionResult;

    expect(result).toEqual({
      fromTurnNumber: 7,
      logPayload: {
        category: "turn_transition",
        fromTurnNumber: 7,
        nextDate,
        previousDate,
        readinessSummary,
        toTurnNumber: 8,
      },
      nextDate,
      notificationPayload: {
        messageText: "Turn 8 is ready.",
        notificationType: "turn_advanced",
      },
      previousDate,
      readinessSummary,
      toTurnNumber: 8,
    });
    expectTypeOf(result).toMatchTypeOf<BasicEndTurnTransitionResult>();
    expectTypeOf(result.logPayload).toMatchTypeOf<BasicEndTurnLogPayload>();
    expectTypeOf(
      result.notificationPayload,
    ).toMatchTypeOf<BasicEndTurnNotificationPayload>();
  });

  it("excludes later simulation domains from the transition result shape", () => {
    expectTypeOf<LaterSimulationResultField>().toEqualTypeOf<never>();
    expectTypeOf<LaterSimulationPayloadField>().toEqualTypeOf<never>();
  });
});
