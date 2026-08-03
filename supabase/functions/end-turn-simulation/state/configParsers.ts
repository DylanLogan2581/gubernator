import { NAME_CONVENTIONS } from "../../_shared/naming/index.ts";
import { isRecord } from "../utils.ts";

import type {
  NameConvention,
  NamePattern,
  NamePatternElement,
} from "../../_shared/naming/index.ts";
import type { NpcFlavorConfig, SimNamingConfig } from "../../_shared/simulation/simulationTypes.ts";
import type { TurnCalendarConfig } from "../../_shared/turnCalendarPrimitives.ts";

// ---------------------------------------------------------------------------
// Calendar config parser — mirrors end-turn-basic/validate.ts
// ---------------------------------------------------------------------------

const expectedCalendarConfigFields = [
  "dateFormatTemplate",
  "shortDateFormatTemplate",
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
    !/\{(?:weekday|month|monthNumber|day|dayNumber|year|yearNumber)\}/.test(
      dateFormatTemplate,
    ) ||
    /\{(?!weekday\}|month\}|monthNumber\}|day\}|dayNumber\}|year\}|yearNumber\})[^{}]+\}/.test(
      dateFormatTemplate,
    )
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
  if (!isRecord(value) || !isNameConvention(value.convention)) return null;
  const convention = value.convention;

  if (value.type === "generated") {
    const parts = parseNamingParts(value.parts);
    if (parts === null) return null;
    const patterns = parseNamingPatterns(value.patterns, parts);
    if (patterns === null) return null;
    return { type: "generated", convention, parts, patterns };
  }

  if (
    !isStringArray(value.male_given_names) ||
    !isStringArray(value.female_given_names) ||
    !isStringArray(value.surnames)
  ) {
    return null;
  }
  return {
    type: "list",
    convention,
    female_given_names: value.female_given_names,
    male_given_names: value.male_given_names,
    surnames: value.surnames,
  };
}

function parseNamingParts(
  value: unknown,
): Readonly<Record<string, readonly string[]>> | null {
  if (!isRecord(value)) return null;
  const parts: Record<string, readonly string[]> = {};
  for (const [key, entries] of Object.entries(value)) {
    if (!isStringArray(entries)) return null;
    parts[key] = entries;
  }
  return parts;
}

function parseNamingPatterns(
  value: unknown,
  parts: Readonly<Record<string, readonly string[]>>,
): { female_given: NamePattern; male_given: NamePattern; surname: NamePattern } | null {
  if (!isRecord(value)) return null;

  const femaleGiven = parseNamePattern(value.female_given, parts);
  const maleGiven = parseNamePattern(value.male_given, parts);
  const surname = parseNamePattern(value.surname, parts);
  if (femaleGiven === null || maleGiven === null || surname === null) {
    return null;
  }

  return { female_given: femaleGiven, male_given: maleGiven, surname };
}

function parseNamePattern(
  value: unknown,
  parts: Readonly<Record<string, readonly string[]>>,
): NamePattern | null {
  if (!Array.isArray(value)) return null;

  const pattern: NamePatternElement[] = [];
  for (const element of value) {
    if (typeof element === "string") {
      pattern.push(element);
      continue;
    }
    if (
      !isStringArray(element) ||
      element.length === 0 ||
      !element.every((listKey) => listKey in parts)
    ) {
      return null;
    }
    pattern.push(element);
  }
  return pattern;
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

function isNameConvention(value: unknown): value is NameConvention {
  return (
    typeof value === "string" &&
    NAME_CONVENTIONS.includes(value as NameConvention)
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
