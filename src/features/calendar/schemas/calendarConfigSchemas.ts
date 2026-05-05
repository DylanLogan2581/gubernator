import { z } from "zod";

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();
const namedCalendarItemNameSchema = z
  .string()
  .refine((value): boolean => value.trim().length > 0, "Name is required.");
const dateFormatTokenPattern = /\{(?:weekday|month|day|year)\}/;
const unsupportedDateFormatTokenPattern =
  /\{(?!weekday\}|month\}|day\}|year\})[^{}]+\}/;

const calendarWeekdaySchema = z.strictObject({
  index: nonnegativeIntegerSchema,
  name: namedCalendarItemNameSchema,
});

const calendarMonthSchema = z.strictObject({
  index: nonnegativeIntegerSchema,
  name: namedCalendarItemNameSchema,
  dayCount: positiveIntegerSchema,
});

export const worldCalendarConfigSchema = z.preprocess(
  normalizeCalendarConfigInput,
  z
    .strictObject({
      dateFormatTemplate: z
        .string()
        .refine(
          (value): boolean => value.trim().length > 0,
          "Date format template is required.",
        )
        .refine(
          (value): boolean => dateFormatTokenPattern.test(value),
          "Date format template must include at least one date token.",
        )
        .refine(
          (value): boolean => !unsupportedDateFormatTokenPattern.test(value),
          "Date format template contains an unsupported token.",
        ),
      weekdays: z
        .array(calendarWeekdaySchema)
        .nonempty("Weekdays are required."),
      months: z.array(calendarMonthSchema).nonempty("Months are required."),
      startingMonthIndex: nonnegativeIntegerSchema,
      startingDayOfMonth: positiveIntegerSchema,
      startingYear: z.number().int(),
      startingWeekdayOffset: nonnegativeIntegerSchema,
    })
    .superRefine((config, context): void => {
      for (const [weekdayIndex, weekday] of config.weekdays.entries()) {
        if (weekday.index !== weekdayIndex) {
          context.addIssue({
            code: "custom",
            message: "Weekday indexes must be contiguous from zero.",
            path: ["weekdays", weekdayIndex, "index"],
          });
        }
      }

      for (const [monthIndex, month] of config.months.entries()) {
        if (month.index !== monthIndex) {
          context.addIssue({
            code: "custom",
            message: "Month indexes must be contiguous from zero.",
            path: ["months", monthIndex, "index"],
          });
        }
      }

      const startingMonth = config.months[config.startingMonthIndex];

      if (startingMonth === undefined) {
        context.addIssue({
          code: "custom",
          message: "Starting month index must match an existing month.",
          path: ["startingMonthIndex"],
        });
      } else if (config.startingDayOfMonth > startingMonth.dayCount) {
        context.addIssue({
          code: "custom",
          message: "Starting day must fit within the starting month.",
          path: ["startingDayOfMonth"],
        });
      }

      if (config.startingWeekdayOffset >= config.weekdays.length) {
        context.addIssue({
          code: "custom",
          message: "Starting weekday offset must match an existing weekday.",
          path: ["startingWeekdayOffset"],
        });
      }
    }),
);

export type WorldCalendarConfig = z.infer<typeof worldCalendarConfigSchema>;

function normalizeCalendarConfigInput(value: unknown): unknown {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("yearFormatTemplate" in value) ||
    "dateFormatTemplate" in value
  ) {
    return value;
  }

  const config = value as { readonly yearFormatTemplate?: unknown };

  if (typeof config.yearFormatTemplate !== "string") {
    return value;
  }

  const { yearFormatTemplate: _yearFormatTemplate, ...rest } = config;

  return {
    ...rest,
    dateFormatTemplate: `{weekday}, {month} {day}, ${config.yearFormatTemplate.replaceAll(
      "{n}",
      "{year}",
    )}`,
  };
}
