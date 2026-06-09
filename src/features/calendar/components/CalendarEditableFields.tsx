import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { FieldError, NumberField } from "./CalendarFieldPrimitives";
import { CalendarListEditor } from "./CalendarListEditor";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";
import type { CalendarValidationErrors } from "../utils/calendarConfigValidation";
import type { JSX } from "react";

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
    <>
      <CalendarListEditor
        addButtonLabel="Add weekday"
        error={errors.weekdays}
        fields={[{ key: "name", label: "Name", type: "text" }]}
        items={config.weekdays}
        legend="Weekdays"
        onAdd={() =>
          onChange({
            ...config,
            weekdays: [
              ...config.weekdays,
              {
                index: config.weekdays.length,
                name: `Weekday ${config.weekdays.length + 1}`,
              },
            ],
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

      <CalendarListEditor
        addButtonLabel="Add month"
        error={errors.months}
        fields={[
          { key: "name", label: "Name", type: "text" },
          { key: "dayCount", label: "Days", type: "number" },
        ]}
        items={config.months}
        legend="Months"
        onAdd={() =>
          onChange({
            ...config,
            months: [
              ...config.months,
              {
                dayCount: 30,
                index: config.months.length,
                name: `Month ${config.months.length + 1}`,
              },
            ],
          })
        }
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
          const startingMonth = months[config.startingMonthIndex];

          onChange({
            ...config,
            months,
            startingDayOfMonth:
              startingMonth === undefined
                ? config.startingDayOfMonth
                : Math.min(config.startingDayOfMonth, startingMonth.dayCount),
          });
        }}
      />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Starting date</legend>
        <div className="grid gap-3 sm:grid-cols-4">
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
      </fieldset>

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
    </>
  );
}
