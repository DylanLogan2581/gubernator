// Shared turn-range default and turn-label formatting for the nation and
// settlement report dashboards — previously duplicated between
// NationReportsSection and SettlementReportsPanel (#1038).

import type { WorldCalendarConfig } from "@/features/calendar";
import {
  formatCalendarDate,
  formatCalendarDateShort,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

const DEFAULT_RANGE_LENGTH = 20;

export function defaultReportTurnRange(currentTurnNumber: number): {
  readonly fromTurn: number;
  readonly toTurn: number;
} {
  const toTurn = Math.max(1, currentTurnNumber);
  const fromTurn = Math.max(1, toTurn - (DEFAULT_RANGE_LENGTH - 1));
  return { fromTurn, toTurn };
}

export type TurnLabelers = {
  /** Long, unambiguous date — used for CSV exports. */
  readonly turnLabel: (turn: number) => string;
  /** Short date — used for chart axis ticks so labels don't overflow (#1004). */
  readonly axisLabel: (turn: number) => string;
};

/**
 * Builds the pair of turn-number label functions report charts/CSVs need.
 * `calendarConfig` is `null` while it's still loading (or failed to load),
 * in which case turns fall back to a plain `T<n>` label.
 */
export function createTurnLabelers(
  calendarConfig: WorldCalendarConfig | null,
): TurnLabelers {
  function turnLabel(turn: number): string {
    if (calendarConfig === null) return `T${String(turn)}`;
    try {
      return formatCalendarDate(resolveTurnCalendarDate(calendarConfig, turn), {
        dateFormatTemplate: calendarConfig.dateFormatTemplate,
      });
    } catch {
      return `T${String(turn)}`;
    }
  }

  function axisLabel(turn: number): string {
    if (calendarConfig === null) return `T${String(turn)}`;
    try {
      return formatCalendarDateShort(
        resolveTurnCalendarDate(calendarConfig, turn),
        {
          shortDateFormatTemplate: calendarConfig.shortDateFormatTemplate,
        },
      );
    } catch {
      return `T${String(turn)}`;
    }
  }

  return { axisLabel, turnLabel };
}
