import { useRef, useState } from "react";

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
import type { TurnCalendarDate } from "../utils/turnCalendarDates";
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

type DateFormatToken = {
  readonly token: string;
  readonly meaning: string;
  readonly example: (date: TurnCalendarDate) => string;
};

const dateFormatTokens: readonly DateFormatToken[] = [
  {
    token: "{weekday}",
    meaning: "Weekday name",
    example: (d) => d.weekdayName,
  },
  { token: "{month}", meaning: "Month name", example: (d) => d.monthName },
  {
    token: "{day}",
    meaning: "Day of the month",
    example: (d) => String(d.dayOfMonth),
  },
  { token: "{year}", meaning: "Year", example: (d) => String(d.year) },
  {
    token: "{monthNumber}",
    meaning: "Month number",
    example: (d) => String(d.monthIndex + 1),
  },
  {
    token: "{dayNumber}",
    meaning: "Day of the month (number)",
    example: (d) => String(d.dayOfMonth),
  },
  {
    token: "{yearNumber}",
    meaning: "Year (number)",
    example: (d) => String(d.year),
  },
];

// Longest tokens first so the splitter matches {monthNumber} before {month}.
const tokenSplitPattern = new RegExp(
  `(${[...dateFormatTokens]
    .map(({ token }) => token)
    .sort((a, b) => b.length - a.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
);

const knownTokens = new Set(dateFormatTokens.map(({ token }) => token));

// Renders a template with recognised tokens badged, so valid tokens are
// visible at a glance without a full syntax-highlighted input.
function HighlightedTemplate({
  template,
}: {
  readonly template: string;
}): JSX.Element {
  if (template.length === 0) {
    return <span className="text-muted-foreground">Empty template.</span>;
  }

  return (
    <>
      {template.split(tokenSplitPattern).map((segment, index) =>
        knownTokens.has(segment) ? (
          <code
            // Segments can repeat, so the index is part of the key.
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${segment}-${index}`}
            className="rounded bg-primary/10 px-1 font-mono text-primary"
          >
            {segment}
          </code>
        ) : (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <span key={`text-${index}`} className="font-mono">
            {segment}
          </span>
        ),
      )}
    </>
  );
}

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

  const longInputRef = useRef<HTMLInputElement>(null);
  const shortInputRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<"long" | "short">("long");

  const insertToken = (token: string): void => {
    const isShort = activeField === "short";
    const input = isShort ? shortInputRef.current : longInputRef.current;
    const current = isShort
      ? config.shortDateFormatTemplate
      : config.dateFormatTemplate;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);

    onChange(
      isShort
        ? { ...config, shortDateFormatTemplate: next }
        : { ...config, dateFormatTemplate: next },
    );

    requestAnimationFrame(() => {
      if (input === null) {
        return;
      }
      const caret = start + token.length;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  };

  let exampleDate: TurnCalendarDate | undefined;
  try {
    exampleDate = resolveTurnCalendarDate(config, 1);
  } catch {
    exampleDate = undefined;
  }

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
              ref={longInputRef}
              aria-describedby={
                errors.dateFormatTemplate === undefined
                  ? undefined
                  : "calendar-date-format-template-error"
              }
              aria-invalid={
                errors.dateFormatTemplate === undefined ? undefined : true
              }
              value={config.dateFormatTemplate}
              onFocus={() => setActiveField("long")}
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
          <p className="text-sm">
            <HighlightedTemplate template={config.dateFormatTemplate} />
          </p>
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
              ref={shortInputRef}
              aria-describedby={
                errors.shortDateFormatTemplate === undefined
                  ? undefined
                  : "calendar-date-format-template-short-error"
              }
              aria-invalid={
                errors.shortDateFormatTemplate === undefined ? undefined : true
              }
              value={config.shortDateFormatTemplate}
              onFocus={() => setActiveField("short")}
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
          <p className="text-sm">
            <HighlightedTemplate template={config.shortDateFormatTemplate} />
          </p>
          <p className="text-sm text-muted-foreground">
            Short: {previewShortDate(config)}
          </p>

          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">
              Tokens (click to insert into the{" "}
              {activeField === "short" ? "short" : "long"} template):
            </p>
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-1 pr-3 font-medium">Token</th>
                  <th className="pb-1 pr-3 font-medium">Meaning</th>
                  <th className="pb-1 font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                {dateFormatTokens.map(({ token, meaning, example }) => (
                  <tr key={token} className="align-top">
                    <td className="pr-3">
                      <button
                        type="button"
                        // Keep the focused template input's caret so the token
                        // lands where the user was typing.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertToken(token)}
                        className="rounded bg-primary/10 px-1 font-mono text-primary hover:bg-primary/20"
                      >
                        {token}
                      </button>
                    </td>
                    <td className="pr-3 text-muted-foreground">{meaning}</td>
                    <td className="text-muted-foreground">
                      {exampleDate === undefined ? "—" : example(exampleDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
