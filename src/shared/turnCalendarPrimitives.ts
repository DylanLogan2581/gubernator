// Pure calendar date types and computation utilities.
//
// This module is shared between the browser app and Supabase Edge Functions.
// Do not import browser-only APIs, Vite-specific code, or the @/ path alias
// here — @/ is a Vite convention that Edge Functions cannot resolve unless an
// explicit import map is configured for the Edge runtime.

export type TurnCalendarDate = {
  turnNumber: number;
  year: number;
  monthIndex: number;
  monthName: string;
  dayOfMonth: number;
  weekdayIndex: number;
  weekdayName: string;
};

export type TurnCalendarConfig = {
  dateFormatTemplate: string;
  months: {
    dayCount: number;
    index: number;
    name: string;
  }[];
  startingDayOfMonth: number;
  startingMonthIndex: number;
  startingWeekdayOffset: number;
  startingYear: number;
  weekdays: {
    index: number;
    name: string;
  }[];
};

type CalendarMonth = TurnCalendarConfig["months"][number];
type CalendarWeekday = TurnCalendarConfig["weekdays"][number];

export function resolveTurnCalendarDate(
  config: TurnCalendarConfig,
  turnNumber: number,
): TurnCalendarDate {
  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new RangeError("Turn number must be a positive integer.");
  }

  const turnOffset = turnNumber - 1;
  const daysPerYear = getDaysPerYear(config.months);
  const startingDayOfYearIndex = getStartingDayOfYearIndex(config);
  const resolvedDayIndex = startingDayOfYearIndex + turnOffset;
  const yearOffset = Math.floor(resolvedDayIndex / daysPerYear);
  const dayOfYearIndex = resolvedDayIndex % daysPerYear;
  const monthDate = resolveMonthDate(config.months, dayOfYearIndex);
  const weekday = resolveWeekday(
    config.weekdays,
    (config.startingWeekdayOffset + turnOffset) % config.weekdays.length,
  );

  return {
    turnNumber,
    year: config.startingYear + yearOffset,
    monthIndex: monthDate.month.index,
    monthName: monthDate.month.name,
    dayOfMonth: monthDate.dayOfMonth,
    weekdayIndex: weekday.index,
    weekdayName: weekday.name,
  };
}

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

function getDaysPerYear(months: CalendarMonth[]): number {
  let daysPerYear = 0;

  for (const month of months) {
    daysPerYear += month.dayCount;
  }

  return daysPerYear;
}

function getStartingDayOfYearIndex(config: TurnCalendarConfig): number {
  let dayOfYearIndex = 0;

  for (const month of config.months) {
    if (month.index === config.startingMonthIndex) {
      return dayOfYearIndex + config.startingDayOfMonth - 1;
    }

    dayOfYearIndex += month.dayCount;
  }

  throw new RangeError(
    "Starting month index must resolve to a configured month.",
  );
}

function resolveMonthDate(
  months: CalendarMonth[],
  dayOfYearIndex: number,
): { month: CalendarMonth; dayOfMonth: number } {
  let remainingDayIndex = dayOfYearIndex;

  for (const month of months) {
    if (remainingDayIndex < month.dayCount) {
      return {
        month,
        dayOfMonth: remainingDayIndex + 1,
      };
    }

    remainingDayIndex -= month.dayCount;
  }

  throw new RangeError("Day of year must resolve to a configured month.");
}

function resolveWeekday(
  weekdays: CalendarWeekday[],
  weekdayIndex: number,
): CalendarWeekday {
  for (const weekday of weekdays) {
    if (weekday.index === weekdayIndex) {
      return weekday;
    }
  }

  throw new RangeError("Weekday index must resolve to a configured weekday.");
}
