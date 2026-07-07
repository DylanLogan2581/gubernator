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
  shortDateFormatTemplate?: string;
};

const dateFormatTokenPattern =
  /\{(?:weekday|month|monthNumber|day|dayNumber|year|yearNumber)\}/;
const unsupportedDateFormatTokenPattern =
  /\{(?!weekday\}|month\}|monthNumber\}|day\}|dayNumber\}|year\}|yearNumber\})[^{}]+\}/;

function getDateFormatTemplateError(
  template: string,
  label: string,
): string | undefined {
  if (template.trim().length < 1) {
    return `${label} is required.`;
  }

  if (!dateFormatTokenPattern.test(template)) {
    return `${label} must include at least one date token.`;
  }

  if (unsupportedDateFormatTokenPattern.test(template)) {
    return `${label} contains an unsupported token.`;
  }

  return undefined;
}

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

  errors.dateFormatTemplate = getDateFormatTemplateError(
    config.dateFormatTemplate,
    "Date format template",
  );
  errors.shortDateFormatTemplate = getDateFormatTemplateError(
    config.shortDateFormatTemplate,
    "Short date format template",
  );

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
    errors.dateFormatTemplate !== undefined ||
    errors.shortDateFormatTemplate !== undefined
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
