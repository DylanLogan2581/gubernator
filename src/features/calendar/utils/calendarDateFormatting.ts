import type { TurnCalendarDate } from "./turnCalendarDates";

export type CalendarDateDisplayVariant = "full" | "compact";

export type CalendarDateFormatOptions = {
  displayVariant: CalendarDateDisplayVariant;
  yearFormatTemplate: string;
};

export function formatCalendarDate(
  calendarDate: TurnCalendarDate,
  options: CalendarDateFormatOptions,
): string {
  const formattedYear = formatCalendarYear(
    calendarDate.year,
    options.yearFormatTemplate,
  );
  const monthDayYear = `${calendarDate.monthName} ${calendarDate.dayOfMonth}, ${formattedYear}`;

  if (options.displayVariant === "compact") {
    return monthDayYear;
  }

  return `${calendarDate.weekdayName}, ${monthDayYear}`;
}

export function formatCalendarYear(
  year: number,
  yearFormatTemplate: string,
): string {
  return yearFormatTemplate.split("{n}").join(String(year));
}
