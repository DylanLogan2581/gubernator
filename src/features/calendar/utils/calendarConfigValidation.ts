import { isSaveWorldCalendarConfigError } from "../mutations/calendarMutations";
import {
  worldCalendarConfigSchema,
  type WorldCalendarConfig,
} from "../schemas/calendarConfigSchemas";

export type CalendarValidationErrors = {
  months?: string;
  startingDayOfMonth?: string;
  startingWeekdayOffset?: string;
  weekdays?: string;
  dateFormatTemplate?: string;
};

export const emptyCalendarValidationErrors: CalendarValidationErrors = {};

export function getCalendarValidationErrors(
  config: WorldCalendarConfig,
): CalendarValidationErrors {
  const parseResult = worldCalendarConfigSchema.safeParse(config);

  if (parseResult.success) {
    return emptyCalendarValidationErrors;
  }

  const errors: CalendarValidationErrors = {};
  const startingMonth = config.months[config.startingMonthIndex];

  if (config.weekdays.length < 1) {
    errors.weekdays = "Add at least one weekday.";
  }

  if (config.months.length < 1) {
    errors.months = "Add at least one month.";
  }

  if (
    startingMonth === undefined ||
    config.startingDayOfMonth < 1 ||
    config.startingDayOfMonth > startingMonth.dayCount
  ) {
    errors.startingDayOfMonth =
      "Starting day must fit within the starting month.";
  }

  if (
    config.startingWeekdayOffset < 0 ||
    config.startingWeekdayOffset >= config.weekdays.length
  ) {
    errors.startingWeekdayOffset =
      "Starting weekday offset must match an existing weekday.";
  }

  if (config.dateFormatTemplate.trim().length < 1) {
    errors.dateFormatTemplate = "Date format template is required.";
  } else if (
    !/\{(?:weekday|month|day|year)\}/.test(config.dateFormatTemplate)
  ) {
    errors.dateFormatTemplate =
      "Date format template must include at least one date token.";
  } else if (
    /\{(?!weekday\}|month\}|day\}|year\})[^{}]+\}/.test(
      config.dateFormatTemplate,
    )
  ) {
    errors.dateFormatTemplate =
      "Date format template contains an unsupported token.";
  }

  return errors;
}

export function hasCalendarValidationErrors(
  errors: CalendarValidationErrors,
): boolean {
  return (
    errors.months !== undefined ||
    errors.startingDayOfMonth !== undefined ||
    errors.startingWeekdayOffset !== undefined ||
    errors.weekdays !== undefined ||
    errors.dateFormatTemplate !== undefined
  );
}

export function getCalendarErrorDescription(error: unknown): string {
  if (isSaveWorldCalendarConfigError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
