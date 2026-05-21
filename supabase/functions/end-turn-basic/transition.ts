import {
  isBasicEndTurnTransitionPlanningError,
  planBasicEndTurnTransition,
} from "../../../src/shared/endTurnTransitionPlanning.ts";
import { formatCalendarDate } from "../../../src/shared/turnCalendarPrimitives.ts";

import { createErrorResponse } from "./http.ts";
import { createTransitionStateUnavailableResult } from "./state.ts";

import type {
  EndTurnBasicDryWriteTransitionResult,
  EndTurnBasicErrorResponse,
} from "./types.ts";
import type {
  BasicEndTurnTransitionInput,
  BasicEndTurnTransitionResult,
} from "../../../src/shared/endTurnTransitionTypes.ts";

export function planDryWriteEndTurnTransition(
  input: BasicEndTurnTransitionInput,
):
  | {
      readonly ok: true;
      readonly transition: BasicEndTurnTransitionResult;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    } {
  try {
    return {
      ok: true,
      transition: planBasicEndTurnTransition(input),
    };
  } catch (error) {
    if (isBasicEndTurnTransitionPlanningError(error)) {
      return {
        error: createErrorResponse({
          code: error.code,
          message: error.message,
        }),
        ok: false,
        status: 409,
      };
    }

    return createTransitionStateUnavailableResult();
  }
}

export function mapDryWriteTransitionResult(
  transition: BasicEndTurnTransitionResult,
  dateFormatTemplate: string,
): EndTurnBasicDryWriteTransitionResult {
  return {
    nextDate: transition.nextDate,
    nextDateLabel: formatCalendarDate(transition.nextDate, {
      dateFormatTemplate,
    }),
    nextTurnNumber: transition.toTurnNumber,
    previousDate: transition.previousDate,
    previousDateLabel: formatCalendarDate(transition.previousDate, {
      dateFormatTemplate,
    }),
    previousTurnNumber: transition.fromTurnNumber,
    readinessSummary: transition.readinessSummary,
  };
}
