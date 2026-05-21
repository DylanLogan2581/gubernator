import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnBasicErrorResponse,
  EndTurnBasicRequestBody,
} from "./types.ts";
import type { TurnCalendarConfig } from "../../../src/shared/turnCalendarPrimitives.ts";

const expectedRequestFields = ["expectedTurnNumber", "worldId"] as const;
const expectedCalendarConfigFields = [
  "dateFormatTemplate",
  "months",
  "startingDayOfMonth",
  "startingMonthIndex",
  "startingWeekdayOffset",
  "startingYear",
  "weekdays",
] as const;
const expectedCalendarMonthFields = ["dayCount", "index", "name"] as const;
const expectedCalendarWeekdayFields = ["index", "name"] as const;

export async function parseEndTurnBasicRequestBody(request: Request): Promise<
  | {
      readonly body: EndTurnBasicRequestBody;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
    }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: ["body"],
        message: "Request body must be valid JSON.",
      }),
      ok: false,
    };
  }

  const bodyShapeResult = parseEndTurnBasicRequestBodyShape(body);

  if (!bodyShapeResult.ok) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: bodyShapeResult.validationErrors,
        message: "Request body must include worldId and expectedTurnNumber.",
      }),
      ok: false,
    };
  }

  return {
    body: {
      expectedTurnNumber: bodyShapeResult.body.expectedTurnNumber,
      worldId: bodyShapeResult.body.worldId.trim(),
    },
    ok: true,
  };
}

function parseEndTurnBasicRequestBodyShape(body: unknown):
  | {
      readonly body: EndTurnBasicRequestBody;
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly validationErrors: readonly string[];
    } {
  const validationErrors = validateEndTurnBasicRequestBody(body);

  if (validationErrors.length > 0 || !isEndTurnBasicRequestBody(body)) {
    return {
      ok: false,
      validationErrors,
    };
  }

  return {
    body,
    ok: true,
  };
}

function validateEndTurnBasicRequestBody(body: unknown): readonly string[] {
  if (!isRecord(body)) {
    return ["body"];
  }

  const validationErrors: string[] = [];

  if (!hasOnlyExpectedFields(body, expectedRequestFields)) {
    validationErrors.push("body");
  }

  if (typeof body.worldId !== "string" || body.worldId.trim().length === 0) {
    validationErrors.push("worldId");
  }

  if (
    typeof body.expectedTurnNumber !== "number" ||
    !Number.isSafeInteger(body.expectedTurnNumber) ||
    body.expectedTurnNumber < 0
  ) {
    validationErrors.push("expectedTurnNumber");
  }

  return validationErrors;
}

function isEndTurnBasicRequestBody(
  body: unknown,
): body is EndTurnBasicRequestBody {
  return (
    isRecord(body) &&
    hasOnlyExpectedFields(body, expectedRequestFields) &&
    typeof body.worldId === "string" &&
    body.worldId.trim().length > 0 &&
    typeof body.expectedTurnNumber === "number" &&
    Number.isSafeInteger(body.expectedTurnNumber) &&
    body.expectedTurnNumber >= 0
  );
}

function hasOnlyExpectedFields(
  body: Record<string, unknown>,
  expectedFields: readonly string[],
): boolean {
  return Object.keys(body).every((fieldName) =>
    expectedFields.some((expectedField) => expectedField === fieldName),
  );
}

export function parseWorldCalendarConfig(
  value: unknown,
): TurnCalendarConfig | null {
  if (
    !isRecord(value) ||
    !hasOnlyExpectedFields(value, expectedCalendarConfigFields)
  ) {
    return null;
  }

  const weekdays = parseCalendarWeekdays(value.weekdays);
  const months = parseCalendarMonths(value.months);

  if (weekdays === null || months === null) {
    return null;
  }

  const startingDayOfMonth = value.startingDayOfMonth;
  const startingMonthIndex = value.startingMonthIndex;
  const startingWeekdayOffset = value.startingWeekdayOffset;
  const startingYear = value.startingYear;
  const dateFormatTemplate = value.dateFormatTemplate;

  if (
    !isNonnegativeInteger(startingMonthIndex) ||
    startingMonthIndex >= months.length ||
    !isPositiveInteger(startingDayOfMonth) ||
    !isInteger(startingYear) ||
    !isNonnegativeInteger(startingWeekdayOffset) ||
    startingWeekdayOffset >= weekdays.length ||
    typeof dateFormatTemplate !== "string" ||
    dateFormatTemplate.trim().length === 0 ||
    !/\{(?:weekday|month|day|year)\}/.test(dateFormatTemplate) ||
    /\{(?!weekday\}|month\}|day\}|year\})[^{}]+\}/.test(dateFormatTemplate)
  ) {
    return null;
  }

  const startingMonth = months[startingMonthIndex];

  if (
    startingMonth === undefined ||
    startingDayOfMonth > startingMonth.dayCount
  ) {
    return null;
  }

  return {
    months,
    startingDayOfMonth,
    startingMonthIndex,
    startingWeekdayOffset,
    startingYear,
    weekdays,
    dateFormatTemplate,
  };
}

function parseCalendarWeekdays(
  value: unknown,
): TurnCalendarConfig["weekdays"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const weekdays: TurnCalendarConfig["weekdays"] = [];

  for (const [weekdayIndex, weekday] of value.entries()) {
    if (
      !isRecord(weekday) ||
      !hasOnlyExpectedFields(weekday, expectedCalendarWeekdayFields) ||
      weekday.index !== weekdayIndex ||
      typeof weekday.name !== "string" ||
      weekday.name.trim().length === 0
    ) {
      return null;
    }

    weekdays.push({
      index: weekday.index,
      name: weekday.name,
    });
  }

  return weekdays;
}

function parseCalendarMonths(
  value: unknown,
): TurnCalendarConfig["months"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const months: TurnCalendarConfig["months"] = [];

  for (const [monthIndex, month] of value.entries()) {
    if (
      !isRecord(month) ||
      !hasOnlyExpectedFields(month, expectedCalendarMonthFields) ||
      month.index !== monthIndex ||
      typeof month.name !== "string" ||
      month.name.trim().length === 0 ||
      !isPositiveInteger(month.dayCount)
    ) {
      return null;
    }

    months.push({
      dayCount: month.dayCount,
      index: month.index,
      name: month.name,
    });
  }

  return months;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
