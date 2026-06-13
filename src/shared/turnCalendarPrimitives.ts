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

export type CalendarDateInput = {
  readonly dayOfMonth: number;
  readonly monthIndex: number;
  readonly year: number;
};

/**
 * Inverse of resolveTurnCalendarDate. Maps a calendar date back to a turn number.
 * Throws RangeError if the date is before turn 1.
 */
export function calendarDateToTurnNumber(
  config: TurnCalendarConfig,
  date: CalendarDateInput,
): number {
  const daysPerYear = getDaysPerYear(config.months);
  const startingDayOfYearIndex = getStartingDayOfYearIndex(config);

  // Compute 0-based day-of-year index for the given date.
  let dayOfYearIndex = date.dayOfMonth - 1;
  for (const month of config.months) {
    if (month.index === date.monthIndex) {
      break;
    }
    dayOfYearIndex += month.dayCount;
  }

  const yearOffset = date.year - config.startingYear;
  const resolvedDayIndex = yearOffset * daysPerYear + dayOfYearIndex;
  const turnNumber = resolvedDayIndex - startingDayOfYearIndex + 1;

  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new RangeError("Calendar date maps to a turn number before turn 1.");
  }

  return turnNumber;
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

export type RelativeTurnDifference = {
  readonly years: number;
  readonly months: number;
  readonly days: number;
  readonly isToday: boolean;
  readonly isPast: boolean;
};

/**
 * Formats a RelativeTurnDifference into a human-readable string.
 * Examples: "Today", "One day from today", "One month, two days from today",
 *           "One year, two months, and three days from today", "Two days ago"
 */
export function formatRelativeTurnDifference(
  diff: RelativeTurnDifference,
): string {
  if (diff.isToday) {
    return "Today";
  }

  const parts: string[] = [];

  if (diff.years === 1) {
    parts.push("one year");
  } else if (diff.years > 1) {
    parts.push(`${diff.years} years`);
  }

  if (diff.months === 1) {
    parts.push("one month");
  } else if (diff.months > 1) {
    parts.push(`${diff.months} months`);
  }

  if (diff.days === 1) {
    parts.push("one day");
  } else if (diff.days > 1) {
    parts.push(`${diff.days} days`);
  }

  // Join with commas and "and", capitalize first element
  let result = "";
  if (parts.length === 1) {
    result = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } else if (parts.length === 2) {
    result = `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)} and ${parts[1]}`;
  } else if (parts.length === 3) {
    result = `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}, ${parts[1]}, and ${parts[2]}`;
  }

  const suffix = diff.isPast ? " ago" : " from today";
  return result + suffix;
}

/**
 * Computes the difference between current turn and selected turn in years, months, days.
 * Properly handles variable month lengths by walking the calendar month by month.
 * Returns object with difference components and flags for today/past.
 */
export function getRelativeTurnDifference(
  config: TurnCalendarConfig,
  currentTurnNumber: number,
  selectedTurnNumber: number,
): RelativeTurnDifference {
  if (currentTurnNumber === selectedTurnNumber) {
    return { years: 0, months: 0, days: 0, isToday: true, isPast: false };
  }

  const isPast = selectedTurnNumber < currentTurnNumber;
  const [startTurn, endTurn] = isPast
    ? [selectedTurnNumber, currentTurnNumber]
    : [currentTurnNumber, selectedTurnNumber];

  const startDate = resolveTurnCalendarDate(config, startTurn);
  let years = 0;
  let months = 0;

  let currentYear = startDate.year;
  let currentMonthIndex = startDate.monthIndex;
  const currentDay = startDate.dayOfMonth;

  // Count complete years by walking forward
  while (true) {
    const monthObj = config.months.find((m) => m.index === currentMonthIndex);
    if (monthObj === undefined) break;
    const clampedDay = Math.min(currentDay, monthObj.dayCount);
    try {
      const testTurn = calendarDateToTurnNumber(config, {
        year: currentYear + 1,
        monthIndex: currentMonthIndex,
        dayOfMonth: clampedDay,
      });
      if (testTurn > endTurn) break;
      years++;
      currentYear++;
    } catch {
      break;
    }
  }

  // Count complete months by walking forward
  while (true) {
    const monthList = config.months.sort((a, b) => a.index - b.index);
    const currentIdx = monthList.findIndex(
      (m) => m.index === currentMonthIndex,
    );
    if (currentIdx === -1) break;

    const nextIdx = currentIdx === monthList.length - 1 ? 0 : currentIdx + 1;
    const nextMonthIndex = monthList[nextIdx].index;
    const nextYear = nextIdx === 0 ? currentYear + 1 : currentYear;

    const nextMonthObj = config.months.find((m) => m.index === nextMonthIndex);
    if (nextMonthObj === undefined) break;
    const clampedDay = Math.min(currentDay, nextMonthObj.dayCount);

    try {
      const testTurn = calendarDateToTurnNumber(config, {
        year: nextYear,
        monthIndex: nextMonthIndex,
        dayOfMonth: clampedDay,
      });
      if (testTurn > endTurn) break;
      months++;
      currentYear = nextYear;
      currentMonthIndex = nextMonthIndex;
    } catch {
      break;
    }
  }

  // Remaining days after years and months
  const currentDateTurn = calendarDateToTurnNumber(config, {
    year: currentYear,
    monthIndex: currentMonthIndex,
    dayOfMonth: currentDay,
  });
  const days = endTurn - currentDateTurn;

  return { years, months, days, isToday: false, isPast };
}
