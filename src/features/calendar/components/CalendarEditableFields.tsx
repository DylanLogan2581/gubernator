import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import {
  formatCalendarDate,
  formatCalendarDateShort,
} from "../utils/calendarDateFormatting";
import { resolveTurnCalendarDate } from "../utils/turnCalendarDates";

import { CalendarChipEditor } from "./CalendarChipEditor";
import { FieldError, NumberField } from "./CalendarFieldPrimitives";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";
import type { CalendarValidationErrors } from "../utils/calendarConfigValidation";
import type { JSX } from "react";

function previewLongDate(config: WorldCalendarConfig): string {
  try {
    return formatCalendarDate(resolveTurnCalendarDate(config, 1), {
      dateFormatTemplate: config.dateFormatTemplate,
    });
  } catch {
    return "Preview unavailable.";
  }
}

function previewShortDate(config: WorldCalendarConfig): string {
  try {
    return formatCalendarDateShort(resolveTurnCalendarDate(config, 1), {
      shortDateFormatTemplate: config.shortDateFormatTemplate,
    });
  } catch {
    return "Preview unavailable.";
  }
}

function moveItem<TItem extends { readonly index: number }>(
  items: readonly TItem[],
  fromIndex: number,
  toIndex: number,
): TItem[] {
  if (
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex ||
    items[fromIndex] === undefined
  ) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next.map((item, position) => ({ ...item, index: position }));
}

const dateFormatTokens = [
  "{weekday}",
  "{month}",
  "{day}",
  "{year}",
  "{monthNumber}",
  "{dayNumber}",
  "{yearNumber}",
] as const;

export function CalendarEditableFields({
  config,
  errors,
  onChange,
}: {
  readonly config: WorldCalendarConfig;
  readonly errors: CalendarValidationErrors;
  readonly onChange: (config: WorldCalendarConfig) => void;
}): JSX.Element {
  const startingMonth = config.months[config.startingMonthIndex];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Weekdays</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarChipEditor
            addButtonLabel="Add weekday"
            addPlaceholder="New weekday"
            error={errors.weekdays}
            itemLabel="Day"
            items={config.weekdays}
            legend="Weekdays"
            onAdd={(name) =>
              onChange({
                ...config,
                weekdays: [
                  ...config.weekdays,
                  {
                    index: config.weekdays.length,
                    name:
                      name.length > 0
                        ? name
                        : `Weekday ${config.weekdays.length + 1}`,
                  },
                ],
              })
            }
            onReorder={(fromIndex, toIndex) =>
              onChange({
                ...config,
                weekdays: moveItem(config.weekdays, fromIndex, toIndex),
              })
            }
            onRemove={(index) => {
              const weekdays = config.weekdays
                .filter((_, weekdayIndex) => weekdayIndex !== index)
                .map((weekday, weekdayIndex) => ({
                  ...weekday,
                  index: weekdayIndex,
                }));

              onChange({
                ...config,
                startingWeekdayOffset: Math.min(
                  config.startingWeekdayOffset,
                  weekdays.length - 1,
                ),
                weekdays,
              });
            }}
            onUpdate={(index, key, value) =>
              onChange({
                ...config,
                weekdays: config.weekdays.map((weekday, weekdayIndex) =>
                  weekdayIndex === index
                    ? { ...weekday, [key]: String(value) }
                    : weekday,
                ),
              })
            }
          />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Months</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarChipEditor
            addButtonLabel="Add month"
            addPlaceholder="New month"
            error={errors.months}
            items={config.months}
            legend="Months"
            showDayCount
            onAdd={(name) =>
              onChange({
                ...config,
                months: [
                  ...config.months,
                  {
                    dayCount: 30,
                    index: config.months.length,
                    name:
                      name.length > 0
                        ? name
                        : `Month ${config.months.length + 1}`,
                  },
                ],
              })
            }
            onReorder={(fromIndex, toIndex) => {
              const months = moveItem(config.months, fromIndex, toIndex);
              const nextStartingMonth = months[config.startingMonthIndex];

              onChange({
                ...config,
                months,
                startingDayOfMonth:
                  nextStartingMonth === undefined
                    ? config.startingDayOfMonth
                    : Math.min(
                        config.startingDayOfMonth,
                        nextStartingMonth.dayCount,
                      ),
              });
            }}
            onRemove={(index) => {
              const months = config.months
                .filter((_, monthIndex) => monthIndex !== index)
                .map((month, monthIndex) => ({
                  ...month,
                  index: monthIndex,
                }));
              const startingMonthIndex = Math.min(
                config.startingMonthIndex,
                months.length - 1,
              );

              onChange({
                ...config,
                months,
                startingDayOfMonth: Math.min(
                  config.startingDayOfMonth,
                  months[startingMonthIndex]?.dayCount ?? 1,
                ),
                startingMonthIndex,
              });
            }}
            onUpdate={(index, key, value) => {
              const months = config.months.map((month, monthIndex) =>
                monthIndex === index ? { ...month, [key]: value } : month,
              );
              const nextStartingMonth = months[config.startingMonthIndex];

              onChange({
                ...config,
                months,
                startingDayOfMonth:
                  nextStartingMonth === undefined
                    ? config.startingDayOfMonth
                    : Math.min(
                        config.startingDayOfMonth,
                        nextStartingMonth.dayCount,
                      ),
              });
            }}
          />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Starting date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label
              htmlFor="calendar-starting-month"
              className="grid gap-1 text-sm"
            >
              <span className="text-muted-foreground">Month</span>
              <NativeSelect
                id="calendar-starting-month"
                value={config.startingMonthIndex}
                onChange={(event) => {
                  const startingMonthIndex = Number(event.currentTarget.value);
                  const startingMonth = config.months[startingMonthIndex];

                  onChange({
                    ...config,
                    startingDayOfMonth:
                      startingMonth === undefined
                        ? config.startingDayOfMonth
                        : Math.min(
                            config.startingDayOfMonth,
                            startingMonth.dayCount,
                          ),
                    startingMonthIndex,
                  });
                }}
              >
                {config.months.map((month) => (
                  <option key={month.index} value={month.index}>
                    {month.name}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <NumberField
              describedBy={
                errors.startingDayOfMonth === undefined
                  ? undefined
                  : "calendar-starting-day-error"
              }
              error={errors.startingDayOfMonth}
              label="Day"
              max={startingMonth?.dayCount}
              min={1}
              value={config.startingDayOfMonth}
              onChange={(value) =>
                onChange({ ...config, startingDayOfMonth: value })
              }
            />
            <NumberField
              label="Year"
              value={config.startingYear}
              onChange={(value) => onChange({ ...config, startingYear: value })}
            />
            <Label
              htmlFor="calendar-weekday-offset"
              className="grid gap-1 text-sm"
            >
              <span className="text-muted-foreground">Weekday offset</span>
              <NativeSelect
                id="calendar-weekday-offset"
                aria-describedby={
                  errors.startingWeekdayOffset === undefined
                    ? undefined
                    : "calendar-weekday-offset-error"
                }
                aria-invalid={
                  errors.startingWeekdayOffset === undefined ? undefined : true
                }
                value={config.startingWeekdayOffset}
                onChange={(event) =>
                  onChange({
                    ...config,
                    startingWeekdayOffset: Number(event.currentTarget.value),
                  })
                }
              >
                {config.weekdays.map((weekday) => (
                  <option key={weekday.index} value={weekday.index}>
                    {weekday.name}
                  </option>
                ))}
              </NativeSelect>
              {errors.startingWeekdayOffset === undefined ? null : (
                <FieldError
                  id="calendar-weekday-offset-error"
                  message={errors.startingWeekdayOffset}
                />
              )}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Date formats</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="calendar-date-format" className="grid gap-1 text-sm">
            <span className="font-medium">Date format template</span>
            <Input
              id="calendar-date-format"
              aria-describedby={
                errors.dateFormatTemplate === undefined
                  ? undefined
                  : "calendar-date-format-template-error"
              }
              aria-invalid={
                errors.dateFormatTemplate === undefined ? undefined : true
              }
              value={config.dateFormatTemplate}
              onChange={(event) =>
                onChange({
                  ...config,
                  dateFormatTemplate: event.currentTarget.value,
                })
              }
            />
            {errors.dateFormatTemplate === undefined ? null : (
              <FieldError
                id="calendar-date-format-template-error"
                message={errors.dateFormatTemplate}
              />
            )}
          </Label>
          <p className="text-sm text-muted-foreground">
            Long: {previewLongDate(config)}
          </p>

          <Label
            htmlFor="calendar-date-format-short"
            className="grid gap-1 text-sm"
          >
            <span className="font-medium">Short date format template</span>
            <Input
              id="calendar-date-format-short"
              aria-describedby={
                errors.shortDateFormatTemplate === undefined
                  ? undefined
                  : "calendar-date-format-template-short-error"
              }
              aria-invalid={
                errors.shortDateFormatTemplate === undefined ? undefined : true
              }
              value={config.shortDateFormatTemplate}
              onChange={(event) =>
                onChange({
                  ...config,
                  shortDateFormatTemplate: event.currentTarget.value,
                })
              }
            />
            {errors.shortDateFormatTemplate === undefined ? null : (
              <FieldError
                id="calendar-date-format-template-short-error"
                message={errors.shortDateFormatTemplate}
              />
            )}
          </Label>
          <p className="text-sm text-muted-foreground">
            Short: {previewShortDate(config)}
          </p>

          <p className="text-xs text-muted-foreground">
            Tokens:{" "}
            {dateFormatTokens.map((token, index) => (
              <span key={token}>
                <code className="font-mono">{token}</code>
                {index === dateFormatTokens.length - 1 ? "" : ", "}
              </span>
            ))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
