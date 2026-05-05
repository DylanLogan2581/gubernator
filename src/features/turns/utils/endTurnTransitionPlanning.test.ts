import { describe, expect, it } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import {
  isBasicEndTurnTransitionPlanningError,
  planBasicEndTurnTransition,
} from "./endTurnTransitionPlanning";

import type { BasicEndTurnTransitionPlanningError } from "./endTurnTransitionPlanning";
import type { BasicEndTurnTransitionInput } from "../types/endTurnTransitionTypes";

const calendarConfig = {
  weekdays: [
    { index: 0, name: "Moonday" },
    { index: 1, name: "Toilsday" },
  ],
  months: [
    { index: 0, name: "Frostmonth", dayCount: 2 },
    { index: 1, name: "Rainmonth", dayCount: 3 },
  ],
  startingMonthIndex: 0,
  startingDayOfMonth: 1,
  startingYear: 12,
  startingWeekdayOffset: 0,
  dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
} satisfies WorldCalendarConfig;

const baseInput = {
  actorId: "user-1",
  calendarConfig,
  currentTurnNumber: 2,
  expectedCurrentTurnNumber: 2,
  isWorldArchived: false,
  readinessRows: [
    {
      autoReadyEnabled: false,
      id: "settlement-1",
      isReadyCurrentTurn: true,
    },
    {
      autoReadyEnabled: false,
      id: "settlement-2",
      isReadyCurrentTurn: false,
    },
    {
      autoReadyEnabled: true,
      id: "settlement-3",
      isReadyCurrentTurn: false,
    },
  ],
  worldId: "world-1",
} satisfies BasicEndTurnTransitionInput;

describe("planBasicEndTurnTransition", () => {
  it("builds a deterministic transition result for a matching current turn", () => {
    const result = planBasicEndTurnTransition(baseInput);

    expect(result).toEqual({
      fromTurnNumber: 2,
      logPayload: {
        fromTurnNumber: 2,
        nextDate: {
          dayOfMonth: 1,
          monthIndex: 1,
          monthName: "Rainmonth",
          turnNumber: 3,
          weekdayIndex: 0,
          weekdayName: "Moonday",
          year: 12,
        },
        previousDate: {
          dayOfMonth: 2,
          monthIndex: 0,
          monthName: "Frostmonth",
          turnNumber: 2,
          weekdayIndex: 1,
          weekdayName: "Toilsday",
          year: 12,
        },
        readinessSummary: {
          notReadySettlementCount: 1,
          readyPercentage: 66.66666666666666,
          readySettlementCount: 2,
          totalSettlementCount: 3,
        },
        toTurnNumber: 3,
      },
      nextDate: {
        dayOfMonth: 1,
        monthIndex: 1,
        monthName: "Rainmonth",
        turnNumber: 3,
        weekdayIndex: 0,
        weekdayName: "Moonday",
        year: 12,
      },
      notificationPayload: {
        messageText: "World advanced to turn 3.",
        notificationType: "turn.completed",
      },
      previousDate: {
        dayOfMonth: 2,
        monthIndex: 0,
        monthName: "Frostmonth",
        turnNumber: 2,
        weekdayIndex: 1,
        weekdayName: "Toilsday",
        year: 12,
      },
      readinessSummary: {
        notReadySettlementCount: 1,
        readyPercentage: 66.66666666666666,
        readySettlementCount: 2,
        totalSettlementCount: 3,
      },
      toTurnNumber: 3,
    });
  });

  it("rejects a stale expected current turn", () => {
    const error = getPlanningError(() =>
      planBasicEndTurnTransition({
        ...baseInput,
        currentTurnNumber: 3,
        expectedCurrentTurnNumber: 2,
      }),
    );

    expect(error).toMatchObject({
      code: "end_turn_stale_expected_turn",
      currentTurnNumber: 3,
      expectedCurrentTurnNumber: 2,
      worldId: "world-1",
    });
  });

  it("plans the seeded bootstrap transition from turn zero to turn one", () => {
    const result = planBasicEndTurnTransition({
      ...baseInput,
      currentTurnNumber: 0,
      expectedCurrentTurnNumber: 0,
    });

    expect(result).toMatchObject({
      fromTurnNumber: 0,
      nextDate: {
        dayOfMonth: 1,
        monthName: "Frostmonth",
        turnNumber: 1,
      },
      previousDate: {
        dayOfMonth: 1,
        monthName: "Frostmonth",
        turnNumber: 1,
      },
      toTurnNumber: 1,
    });
    expect(result.logPayload.fromTurnNumber).toBe(0);
    expect(result.logPayload.toTurnNumber).toBe(1);
  });

  it("rejects archived worlds", () => {
    const error = getPlanningError(() =>
      planBasicEndTurnTransition({
        ...baseInput,
        isWorldArchived: true,
      }),
    );

    expect(error).toMatchObject({
      code: "end_turn_world_archived",
      currentTurnNumber: 2,
      expectedCurrentTurnNumber: 2,
      worldId: "world-1",
    });
  });

  it("returns a stable readiness summary for worlds without settlements", () => {
    const result = planBasicEndTurnTransition({
      ...baseInput,
      readinessRows: [],
    });

    expect(result.readinessSummary).toEqual({
      notReadySettlementCount: 0,
      readyPercentage: 0,
      readySettlementCount: 0,
      totalSettlementCount: 0,
    });
    expect(result.logPayload.readinessSummary).toBe(result.readinessSummary);
  });
});

function getPlanningError(
  action: () => void,
): BasicEndTurnTransitionPlanningError {
  try {
    action();
  } catch (error) {
    if (isBasicEndTurnTransitionPlanningError(error)) {
      return error;
    }
  }

  throw new TypeError("Expected planning error.");
}
