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

type WorldCalendarConfig = TurnCalendarConfig;
type CalendarMonth = WorldCalendarConfig["months"][number];
type CalendarWeekday = WorldCalendarConfig["weekdays"][number];

export function resolveTurnCalendarDate(
  config: WorldCalendarConfig,
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

function getDaysPerYear(months: CalendarMonth[]): number {
  let daysPerYear = 0;

  for (const month of months) {
    daysPerYear += month.dayCount;
  }

  return daysPerYear;
}

function getStartingDayOfYearIndex(config: WorldCalendarConfig): number {
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
