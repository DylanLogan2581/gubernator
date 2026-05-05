import type { TurnCalendarDate } from "./turnCalendarDates";

export type CalendarDateFormatOptions = {
  dateFormatTemplate: string;
};

export function formatCalendarDate(
  calendarDate: TurnCalendarDate,
  options: CalendarDateFormatOptions,
): string {
  return options.dateFormatTemplate
    .split("{weekday}")
    .join(calendarDate.weekdayName)
    .split("{month}")
    .join(calendarDate.monthName)
    .split("{day}")
    .join(String(calendarDate.dayOfMonth))
    .split("{year}")
    .join(String(calendarDate.year));
}

export function formatCalendarYear(year: number): string {
  return String(year);
}
