import {
  formatCalendarDate,
  formatCalendarYear,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

type CalendarConfig = Parameters<typeof resolveTurnCalendarDate>[0] | null;

export function formatAppointedTurn(
  turnNumber: number,
  calendarConfig: CalendarConfig,
): string {
  if (calendarConfig === null) {
    return `Turn ${String(turnNumber)}`;
  }
  try {
    return formatCalendarDate(
      resolveTurnCalendarDate(calendarConfig, turnNumber),
      { dateFormatTemplate: calendarConfig.dateFormatTemplate },
    );
  } catch {
    return `Turn ${String(turnNumber)}`;
  }
}

// #1123: term_turns null = indefinite; otherwise show when the seat expires.
export function formatTermStatus(
  entry: {
    readonly expiresTurnNumber: number | null;
    readonly termTurns: number | null;
  },
  calendarConfig: CalendarConfig,
): string {
  if (entry.termTurns === null || entry.expiresTurnNumber === null) {
    return "Indefinite term";
  }
  if (calendarConfig === null) {
    return `Ends turn ${String(entry.expiresTurnNumber)}`;
  }
  try {
    return `Ends Year ${formatCalendarYear(
      resolveTurnCalendarDate(calendarConfig, entry.expiresTurnNumber).year,
    )}`;
  } catch {
    return `Ends turn ${String(entry.expiresTurnNumber)}`;
  }
}
