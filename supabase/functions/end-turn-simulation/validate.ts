import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnSimulationErrorResponse,
  EndTurnSimulationRequestBody,
} from "./types.ts";
import type { NpcFlavorConfig } from "../../../src/shared/simulation/simulationTypes.ts";
import type { TurnCalendarConfig } from "../../../src/shared/turnCalendarPrimitives.ts";

const expectedRequestFields = ["expectedTurnNumber", "worldId"] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function parseEndTurnSimulationRequestBody(
  request: Request,
): Promise<
  | {
      readonly body: EndTurnSimulationRequestBody;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnSimulationErrorResponse;
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

  const bodyShapeResult = parseEndTurnSimulationRequestBodyShape(body);

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

function parseEndTurnSimulationRequestBodyShape(body: unknown):
  | {
      readonly body: EndTurnSimulationRequestBody;
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly validationErrors: readonly string[];
    } {
  const validationErrors = validateEndTurnSimulationRequestBody(body);

  if (validationErrors.length > 0 || !isEndTurnSimulationRequestBody(body)) {
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

function validateEndTurnSimulationRequestBody(
  body: unknown,
): readonly string[] {
  if (!isRecord(body)) {
    return ["body"];
  }

  const validationErrors: string[] = [];

  if (!hasOnlyExpectedFields(body, expectedRequestFields)) {
    validationErrors.push("body");
  }

  if (
    typeof body.worldId !== "string" ||
    !UUID_REGEX.test(body.worldId.trim())
  ) {
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

function isEndTurnSimulationRequestBody(
  body: unknown,
): body is EndTurnSimulationRequestBody {
  return (
    isRecord(body) &&
    hasOnlyExpectedFields(body, expectedRequestFields) &&
    typeof body.worldId === "string" &&
    UUID_REGEX.test(body.worldId.trim()) &&
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

// ---------------------------------------------------------------------------
// Calendar config parser — mirrors end-turn-basic/validate.ts
// ---------------------------------------------------------------------------

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

  const {
    startingDayOfMonth,
    startingMonthIndex,
    startingWeekdayOffset,
    startingYear,
    dateFormatTemplate,
  } = value;

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
    dateFormatTemplate,
    months,
    startingDayOfMonth,
    startingMonthIndex,
    startingWeekdayOffset,
    startingYear,
    weekdays,
  };
}

function parseCalendarWeekdays(
  value: unknown,
): TurnCalendarConfig["weekdays"] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const weekdays: TurnCalendarConfig["weekdays"] = [];

  for (const [i, weekday] of value.entries()) {
    if (
      !isRecord(weekday) ||
      !hasOnlyExpectedFields(weekday, expectedCalendarWeekdayFields) ||
      weekday.index !== i ||
      typeof weekday.name !== "string" ||
      weekday.name.trim().length === 0
    ) {
      return null;
    }
    weekdays.push({ index: weekday.index, name: weekday.name });
  }

  return weekdays;
}

function parseCalendarMonths(
  value: unknown,
): TurnCalendarConfig["months"] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const months: TurnCalendarConfig["months"] = [];

  for (const [i, month] of value.entries()) {
    if (
      !isRecord(month) ||
      !hasOnlyExpectedFields(month, expectedCalendarMonthFields) ||
      month.index !== i ||
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

export function parseWorldNpcFlavorConfig(
  value: unknown,
): NpcFlavorConfig | null {
  if (!isRecord(value)) return null;
  if (
    !isStringArray(value.traits) ||
    !isStringArray(value.flaws) ||
    !isStringArray(value.goals) ||
    !isStringArray(value.contradictions)
  ) {
    return null;
  }
  return {
    contradictions: value.contradictions,
    flaws: value.flaws,
    goals: value.goals,
    traits: value.traits,
  };
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
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
