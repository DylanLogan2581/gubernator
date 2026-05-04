import { describe, expect, expectTypeOf, it } from "vitest";

import {
  calendarQueryKeys,
  formatCalendarDate,
  formatCalendarYear,
  resolveTurnCalendarDate,
  shouldRetryWorldCalendarConfigQuery,
  worldCalendarConfigQueryOptions,
  worldCalendarConfigSchema,
  type CalendarDateDisplayVariant,
  type CalendarDateFormatOptions,
  type TurnCalendarDate,
  type WorldCalendarConfig,
} from "@/features/calendar";
import {
  notificationQueryKeys,
  turnCompletedNotificationsQueryOptions,
  unreadNotificationsCountQueryOptions,
  type TurnCompletedNotification,
  type TurnCompletedNotificationsFilters,
} from "@/features/notifications";
import {
  SettlementReadinessListPanel,
  SettlementReadinessListPanelContent,
  SettlementReadinessSummaryPanel,
  SettlementReadinessSummaryPanelContent,
  computeSettlementReadinessSummary,
  createSettlementReadinessResetUpdate,
  createSettlementReadinessResetUpdatePayload,
  createSettlementReadinessResetUpdates,
  isSettlementReadyForCurrentTurn,
  settlementReadinessListQueryOptions,
  settlementReadinessQueryKeys,
  settlementReadinessSummaryQueryOptions,
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
  type SettlementReadinessListItem,
  type SettlementReadinessResetRow,
  type SettlementReadinessResetUpdate,
  type SettlementReadinessResetUpdatePayload,
  type SettlementReadinessSummary,
} from "@/features/settlements";
import {
  EndTurnControl,
  currentTurnStateQueryOptions,
  endTurnBasicMutationOptions,
  latestTurnTransitionStatusQueryOptions,
  planBasicEndTurnTransition,
  shouldRetryCurrentTurnStateQuery,
  shouldRetryLatestTurnTransitionStatusQuery,
  turnQueryKeys,
  type BasicEndTurnTransitionInput,
  type CurrentTurnDateDisplay,
  type EndTurnBasicInput,
  type LatestTurnTransitionStatus,
} from "@/features/turns";

describe("public feature entrypoints", () => {
  it("exports the Epic 2 calendar public surface", () => {
    expect(calendarQueryKeys.all).toEqual(["calendar"]);
    expect(worldCalendarConfigSchema.safeParse({}).success).toBe(false);
    expect(worldCalendarConfigQueryOptions).toEqual(expect.any(Function));
    expect(shouldRetryWorldCalendarConfigQuery).toEqual(expect.any(Function));
    expect(formatCalendarDate).toEqual(expect.any(Function));
    expect(formatCalendarYear).toEqual(expect.any(Function));
    expect(resolveTurnCalendarDate).toEqual(expect.any(Function));

    expectTypeOf<CalendarDateDisplayVariant>().toEqualTypeOf<
      "compact" | "full"
    >();
    expectTypeOf<CalendarDateFormatOptions>().toMatchTypeOf<{
      readonly displayVariant: CalendarDateDisplayVariant;
      readonly yearFormatTemplate: string;
    }>();
    expectTypeOf<
      Pick<TurnCalendarDate, "dayOfMonth" | "monthName" | "turnNumber" | "year">
    >().toEqualTypeOf<{
      dayOfMonth: number;
      monthName: string;
      turnNumber: number;
      year: number;
    }>();
    expectTypeOf<
      Pick<WorldCalendarConfig, "months" | "startingYear" | "weekdays">
    >().toMatchTypeOf<{
      months: {
        dayCount: number;
        index: number;
        name: string;
      }[];
      startingYear: number;
      weekdays: {
        index: number;
        name: string;
      }[];
    }>();
  });

  it("exports the Epic 2 turns public surface", () => {
    expect(turnQueryKeys.all).toEqual(["turns"]);
    expect(currentTurnStateQueryOptions).toEqual(expect.any(Function));
    expect(latestTurnTransitionStatusQueryOptions).toEqual(
      expect.any(Function),
    );
    expect(endTurnBasicMutationOptions).toEqual(expect.any(Function));
    expect(EndTurnControl).toEqual(expect.any(Function));
    expect(planBasicEndTurnTransition).toEqual(expect.any(Function));
    expect(shouldRetryCurrentTurnStateQuery).toEqual(expect.any(Function));
    expect(shouldRetryLatestTurnTransitionStatusQuery).toEqual(
      expect.any(Function),
    );

    expectTypeOf<
      Pick<
        BasicEndTurnTransitionInput,
        "actorId" | "currentTurnNumber" | "worldId"
      >
    >().toEqualTypeOf<{
      readonly actorId: string;
      readonly currentTurnNumber: number;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<CurrentTurnDateDisplay, "currentTurnNumber" | "worldId">
    >().toEqualTypeOf<{
      readonly currentTurnNumber: number;
      readonly worldId: string;
    }>();
    expectTypeOf<EndTurnBasicInput>().toEqualTypeOf<{
      readonly expectedTurnNumber: number;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<LatestTurnTransitionStatus, "state" | "worldId">
    >().toEqualTypeOf<{
      readonly state: "completed" | "failed" | "running";
      readonly worldId: string;
    }>();
  });

  it("exports the Epic 2 settlements public surface", () => {
    expect(settlementReadinessQueryKeys.all).toEqual(["settlements"]);
    expect(settlementReadinessListQueryOptions).toEqual(expect.any(Function));
    expect(settlementReadinessSummaryQueryOptions).toEqual(
      expect.any(Function),
    );
    expect(setSettlementAutoReadyMutationOptions).toEqual(expect.any(Function));
    expect(setSettlementReadinessMutationOptions).toEqual(expect.any(Function));
    expect(SettlementReadinessListPanel).toEqual(expect.any(Function));
    expect(SettlementReadinessListPanelContent).toEqual(expect.any(Function));
    expect(SettlementReadinessSummaryPanel).toEqual(expect.any(Function));
    expect(SettlementReadinessSummaryPanelContent).toEqual(
      expect.any(Function),
    );
    expect(computeSettlementReadinessSummary).toEqual(expect.any(Function));
    expect(createSettlementReadinessResetUpdate).toEqual(expect.any(Function));
    expect(createSettlementReadinessResetUpdatePayload).toEqual(
      expect.any(Function),
    );
    expect(createSettlementReadinessResetUpdates).toEqual(expect.any(Function));
    expect(isSettlementReadyForCurrentTurn).toEqual(expect.any(Function));

    expectTypeOf<
      Pick<
        SettlementReadinessListItem,
        "id" | "isReadyForCurrentTurn" | "name" | "nationId"
      >
    >().toEqualTypeOf<{
      readonly id: string;
      readonly isReadyForCurrentTurn: boolean;
      readonly name: string;
      readonly nationId: string;
    }>();
    expectTypeOf<SettlementReadinessResetRow>().toMatchTypeOf<{
      readonly auto_ready_enabled: boolean;
      readonly id: string;
    }>();
    expectTypeOf<SettlementReadinessResetUpdate>().toEqualTypeOf<{
      readonly id: string;
      readonly payload: SettlementReadinessResetUpdatePayload;
    }>();
    expectTypeOf<SettlementReadinessSummary>().toEqualTypeOf<{
      readonly notReadySettlementCount: number;
      readonly readyPercentage: number;
      readonly readySettlementCount: number;
      readonly totalSettlementCount: number;
    }>();
  });

  it("exports the Epic 2 notifications public surface", () => {
    expect(notificationQueryKeys.all).toEqual(["notifications"]);
    expect(turnCompletedNotificationsQueryOptions).toEqual(
      expect.any(Function),
    );
    expect(unreadNotificationsCountQueryOptions).toEqual(expect.any(Function));

    expectTypeOf<TurnCompletedNotification>().toMatchTypeOf<{
      readonly id: string;
      readonly isRead: boolean;
      readonly worldId: string;
    }>();
    expectTypeOf<TurnCompletedNotificationsFilters>().toMatchTypeOf<{
      readonly worldId?: string | null;
    }>();
  });
});
