import { z } from "zod";

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();
const namedCalendarItemNameSchema = z
  .string()
  .refine((value): boolean => value.trim().length > 0, "Name is required.");

const calendarWeekdaySchema = z.strictObject({
  index: nonnegativeIntegerSchema,
  name: namedCalendarItemNameSchema,
});

const calendarMonthSchema = z.strictObject({
  index: nonnegativeIntegerSchema,
  name: namedCalendarItemNameSchema,
  dayCount: positiveIntegerSchema,
});

export const worldCalendarConfigSchema = z
  .strictObject({
    weekdays: z.array(calendarWeekdaySchema).nonempty("Weekdays are required."),
    months: z.array(calendarMonthSchema).nonempty("Months are required."),
    startingMonthIndex: nonnegativeIntegerSchema,
    startingDayOfMonth: positiveIntegerSchema,
    startingYear: z.number().int(),
    startingWeekdayOffset: nonnegativeIntegerSchema,
    yearFormatTemplate: z
      .string()
      .refine(
        (value): boolean => value.trim().length > 0,
        "Year format template is required.",
      )
      .refine(
        (value): boolean => value.includes("{n}"),
        "Year format template must include {n}.",
      ),
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
  });

export type WorldCalendarConfig = z.infer<typeof worldCalendarConfigSchema>;
