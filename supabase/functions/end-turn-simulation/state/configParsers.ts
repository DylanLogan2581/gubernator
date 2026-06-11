import { isRecord } from "../utils.ts";

import type { NpcFlavorConfig, SimNamingConfig } from "../../_shared/simulation/simulationTypes.ts";
import type { TurnCalendarConfig } from "../../_shared/turnCalendarPrimitives.ts";

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

export function parseWorldNamingConfig(value: unknown): SimNamingConfig | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.convention !== "string" ||
    !isStringArray(value.male_given_names) ||
    !isStringArray(value.female_given_names) ||
    !isStringArray(value.surnames)
  ) {
    return null;
  }
  return {
    convention: value.convention,
    female_given_names: value.female_given_names,
    male_given_names: value.male_given_names,
    surnames: value.surnames,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function hasOnlyExpectedFields(
  body: Record<string, unknown>,
  expectedFields: readonly string[],
): boolean {
  return Object.keys(body).every((fieldName) =>
    expectedFields.some((expectedField) => expectedField === fieldName)
  );
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
