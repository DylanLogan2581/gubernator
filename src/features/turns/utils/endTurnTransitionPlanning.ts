import { resolveTurnCalendarDate } from "@/features/calendar";

import type {
  BasicEndTurnReadinessRow,
  BasicEndTurnReadinessSummary,
  BasicEndTurnTransitionInput,
  BasicEndTurnTransitionResult,
} from "../types/endTurnTransitionTypes";

export type BasicEndTurnTransitionPlanningErrorCode =
  | "end_turn_stale_expected_turn"
  | "end_turn_world_archived";

export class BasicEndTurnTransitionPlanningError extends Error {
  readonly code: BasicEndTurnTransitionPlanningErrorCode;
  readonly currentTurnNumber: number;
  readonly expectedCurrentTurnNumber: number;
  readonly worldId: string;

  constructor({
    code,
    currentTurnNumber,
    expectedCurrentTurnNumber,
    message,
    worldId,
  }: {
    readonly code: BasicEndTurnTransitionPlanningErrorCode;
    readonly currentTurnNumber: number;
    readonly expectedCurrentTurnNumber: number;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "BasicEndTurnTransitionPlanningError";
    this.code = code;
    this.currentTurnNumber = currentTurnNumber;
    this.expectedCurrentTurnNumber = expectedCurrentTurnNumber;
    this.worldId = worldId;
  }
}

export function planBasicEndTurnTransition(
  input: BasicEndTurnTransitionInput,
): BasicEndTurnTransitionResult {
  if (input.currentTurnNumber !== input.expectedCurrentTurnNumber) {
    throw new BasicEndTurnTransitionPlanningError({
      code: "end_turn_stale_expected_turn",
      currentTurnNumber: input.currentTurnNumber,
      expectedCurrentTurnNumber: input.expectedCurrentTurnNumber,
      message: "Expected current turn no longer matches the world state.",
      worldId: input.worldId,
    });
  }

  if (input.isWorldArchived) {
    throw new BasicEndTurnTransitionPlanningError({
      code: "end_turn_world_archived",
      currentTurnNumber: input.currentTurnNumber,
      expectedCurrentTurnNumber: input.expectedCurrentTurnNumber,
      message: "Archived worlds cannot advance turns.",
      worldId: input.worldId,
    });
  }

  const fromTurnNumber = input.currentTurnNumber;
  const toTurnNumber = fromTurnNumber + 1;
  const previousDate = resolveTurnCalendarDate(
    input.calendarConfig,
    fromTurnNumber,
  );
  const nextDate = resolveTurnCalendarDate(input.calendarConfig, toTurnNumber);
  const readinessSummary = computeBasicEndTurnReadinessSummary(
    input.readinessRows,
  );

  return {
    fromTurnNumber,
    logPayload: {
      fromTurnNumber,
      nextDate,
      previousDate,
      readinessSummary,
      toTurnNumber,
    },
    nextDate,
    notificationPayload: {
      messageText: `Turn ${toTurnNumber} is ready.`,
      notificationType: "turn_advanced",
    },
    previousDate,
    readinessSummary,
    toTurnNumber,
  };
}

export function isBasicEndTurnTransitionPlanningError(
  error: unknown,
): error is BasicEndTurnTransitionPlanningError {
  return error instanceof BasicEndTurnTransitionPlanningError;
}

function computeBasicEndTurnReadinessSummary(
  rows: readonly BasicEndTurnReadinessRow[],
): BasicEndTurnReadinessSummary {
  const totalSettlementCount = rows.length;
  const readySettlementCount = rows.filter(isReadyForCurrentTurn).length;
  const notReadySettlementCount = totalSettlementCount - readySettlementCount;
  const readyPercentage =
    totalSettlementCount === 0
      ? 0
      : (readySettlementCount / totalSettlementCount) * 100;

  return {
    notReadySettlementCount,
    readyPercentage,
    readySettlementCount,
    totalSettlementCount,
  };
}

function isReadyForCurrentTurn(row: BasicEndTurnReadinessRow): boolean {
  return row.autoReadyEnabled || row.isReadyCurrentTurn;
}
