import { describe, expect, expectTypeOf, it } from "vitest";

import {
  calendarQueryKeys,
  formatCalendarDate,
  formatCalendarYear,
  resolveTurnCalendarDate,
  shouldRetryWorldCalendarConfigQuery,
  worldCalendarConfigQueryOptions,
  worldCalendarConfigSchema,
  type CalendarDateFormatOptions,
  type TurnCalendarDate,
  type WorldCalendarConfig,
} from "@/features/calendar";
import {
  BulkConstructionPoolMutationError,
  setBulkConstructionPoolInputSchema,
  setBulkConstructionPoolMutationOptions,
  type SetBulkConstructionPoolInput,
  type SetBulkConstructionPoolValues,
} from "@/features/citizens";
import {
  managedPopulationSnapshotsBySettlementQueryOptions,
  type ManagedPopSnapshotCounts,
} from "@/features/managed-populations";
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
  EndTurnTransitionError,
  TurnTransitionOutcomeContent,
  TurnTransitionOutcomeEmptyState,
  TurnTransitionOutcomePanel,
  currentTurnStateQueryOptions,
  endTurnTransitionMutationOptions,
  latestSettlementTransitionOutcomeQueryOptions,
  latestTurnTransitionStatusQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
  shouldRetryCurrentTurnStateQuery,
  shouldRetryLatestTurnTransitionStatusQuery,
  turnQueryKeys,
  type CurrentTurnDateDisplay,
  type EndTurnTransitionInput,
  type EndTurnTransitionMutationResult,
  type EndTurnTransitionSummary,
  type LatestTurnTransitionStatus,
  type TurnTransitionLogEntry,
  type TurnTransitionNotification,
  type TurnTransitionOutcome,
  type TurnTransitionResourceSnapshot,
  type TurnTransitionSettlementSnapshot,
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

    expectTypeOf<CalendarDateFormatOptions>().toMatchTypeOf<{
      readonly dateFormatTemplate: string;
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
    expect(EndTurnControl).toEqual(expect.any(Function));
    expect(shouldRetryCurrentTurnStateQuery).toEqual(expect.any(Function));
    expect(shouldRetryLatestTurnTransitionStatusQuery).toEqual(
      expect.any(Function),
    );

    expectTypeOf<
      Pick<CurrentTurnDateDisplay, "currentTurnNumber" | "worldId">
    >().toEqualTypeOf<{
      readonly currentTurnNumber: number;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<LatestTurnTransitionStatus, "state" | "worldId">
    >().toEqualTypeOf<{
      readonly state: "completed" | "failed" | "running";
      readonly worldId: string;
    }>();
  });

  it("exports the Epic 6 turns public surface", () => {
    expect(endTurnTransitionMutationOptions).toEqual(expect.any(Function));
    expect(EndTurnTransitionError).toEqual(expect.any(Function));
    expect(TurnTransitionOutcomePanel).toEqual(expect.any(Function));
    expect(TurnTransitionOutcomeContent).toEqual(expect.any(Function));
    expect(TurnTransitionOutcomeEmptyState).toEqual(expect.any(Function));
    expect(latestSettlementTransitionOutcomeQueryOptions).toEqual(
      expect.any(Function),
    );
    expect(latestWorldTransitionOutcomeQueryOptions).toEqual(
      expect.any(Function),
    );

    expectTypeOf<
      Pick<EndTurnTransitionInput, "expectedTurnNumber" | "worldId">
    >().toEqualTypeOf<{
      readonly expectedTurnNumber: number;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<EndTurnTransitionMutationResult, "actorId" | "worldId">
    >().toEqualTypeOf<{
      readonly actorId: string;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<EndTurnTransitionSummary, "currentTurnNumber" | "transitionId">
    >().toEqualTypeOf<{
      readonly currentTurnNumber: number;
      readonly transitionId: string;
    }>();
    expectTypeOf<
      Pick<TurnTransitionOutcome, "id" | "status" | "worldId">
    >().toEqualTypeOf<{
      readonly id: string;
      readonly status: string;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<TurnTransitionNotification, "id" | "isRead" | "worldId">
    >().toEqualTypeOf<{
      readonly id: string;
      readonly isRead: boolean;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<TurnTransitionLogEntry, "id" | "logCategory" | "worldId">
    >().toEqualTypeOf<{
      readonly id: string;
      readonly logCategory: string;
      readonly worldId: string;
    }>();
    expectTypeOf<
      Pick<TurnTransitionResourceSnapshot, "id" | "resourceId" | "settlementId">
    >().toEqualTypeOf<{
      readonly id: string;
      readonly resourceId: string;
      readonly settlementId: string;
    }>();
    expectTypeOf<
      Pick<
        TurnTransitionSettlementSnapshot,
        "id" | "populationTotal" | "settlementId"
      >
    >().toEqualTypeOf<{
      readonly id: string;
      readonly populationTotal: number;
      readonly settlementId: string;
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

  it("exports the Epic 6 managed-populations public surface", () => {
    expect(managedPopulationSnapshotsBySettlementQueryOptions).toEqual(
      expect.any(Function),
    );

    expectTypeOf<ManagedPopSnapshotCounts>().toEqualTypeOf<{
      readonly latestCounts: ReadonlyMap<string, number> | null;
      readonly prevCounts: ReadonlyMap<string, number> | null;
    }>();
  });

  it("exports the Epic 6 citizens bulk-construction-pool public surface", () => {
    expect(BulkConstructionPoolMutationError).toEqual(expect.any(Function));
    expect(setBulkConstructionPoolMutationOptions).toEqual(
      expect.any(Function),
    );
    expect(setBulkConstructionPoolInputSchema.safeParse({}).success).toBe(
      false,
    );

    expectTypeOf<
      Pick<SetBulkConstructionPoolInput, "settlementId" | "targetCount">
    >().toMatchTypeOf<{
      settlementId: string;
      targetCount: number;
    }>();
    expectTypeOf<
      Pick<SetBulkConstructionPoolValues, "settlementId" | "targetCount">
    >().toMatchTypeOf<{
      settlementId: string;
      targetCount: number;
    }>();
  });
});
