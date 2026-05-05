import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorldPermissionContext } from "@/features/worlds";

import {
  isSaveWorldCalendarConfigError,
  saveWorldCalendarConfigMutationOptions,
} from "../mutations/calendarMutations";
import { worldCalendarConfigQueryOptions } from "../queries/calendarQueries";
import {
  worldCalendarConfigSchema,
  type WorldCalendarConfig,
} from "../schemas/calendarConfigSchemas";

type CalendarValidationErrors = {
  months?: string;
  startingDayOfMonth?: string;
  startingWeekdayOffset?: string;
  weekdays?: string;
  dateFormatTemplate?: string;
};

const emptyCalendarValidationErrors: CalendarValidationErrors = {};

type WorldCalendarConfigPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldCalendarConfigPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
}: WorldCalendarConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));

  if (calendarQuery.isPending) {
    return (
      <section
        aria-labelledby="world-calendar-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading calendar…" />
      </section>
    );
  }

  if (calendarQuery.isError) {
    return (
      <section
        aria-labelledby="world-calendar-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Calendar could not be loaded"
          description={getErrorDescription(calendarQuery.error)}
        />
      </section>
    );
  }

  return (
    <WorldCalendarConfigPanelContent
      accessContext={accessContext}
      canAdmin={canAdmin}
      initialConfig={calendarQuery.data}
      isArchived={isArchived}
      queryClient={queryClient}
      worldId={worldId}
    />
  );
}

function WorldCalendarConfigPanelContent({
  accessContext,
  canAdmin,
  initialConfig,
  isArchived,
  queryClient,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly initialConfig: WorldCalendarConfig;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const saveMutation = useMutation(
    saveWorldCalendarConfigMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const [draftConfig, setDraftConfig] =
    useState<WorldCalendarConfig>(initialConfig);
  const [validationErrors, setValidationErrors] =
    useState<CalendarValidationErrors>(emptyCalendarValidationErrors);

  const canEdit = canAdmin && !isArchived;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextValidationErrors = getCalendarValidationErrors(draftConfig);
    setValidationErrors(nextValidationErrors);

    if (hasCalendarValidationErrors(nextValidationErrors)) {
      saveMutation.reset();
      return;
    }

    saveMutation.mutate({
      config: draftConfig,
      worldId,
    });
  }

  function resetDraftConfig(): void {
    setDraftConfig(initialConfig);
    setValidationErrors(emptyCalendarValidationErrors);
    saveMutation.reset();
  }

  return (
    <section
      aria-labelledby="world-calendar-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="world-calendar-title"
            className="text-lg font-semibold tracking-normal"
          >
            Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "World admins can edit the calendar used by turn progression."
              : "Calendar configuration is read-only for your current access."}
          </p>
        </div>
        {!canEdit ? (
          <span className="inline-flex w-fit rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
            Read-only
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <form
          aria-label="World calendar configuration"
          className="grid gap-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <CalendarEditableFields
            config={draftConfig}
            errors={validationErrors}
            onChange={(config) => {
              setDraftConfig(config);
              setValidationErrors(emptyCalendarValidationErrors);
            }}
          />

          {saveMutation.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorDescription(saveMutation.error)}
            </p>
          ) : null}
          {saveMutation.isSuccess ? (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Calendar saved.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save aria-hidden="true" />
              Save calendar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetDraftConfig}
              disabled={saveMutation.isPending}
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
          </div>
        </form>
      ) : (
        <CalendarReadOnlySummary config={draftConfig} />
      )}
    </section>
  );
}

function CalendarEditableFields({
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Month</span>
            <select
              className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            </select>
          </label>
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Weekday offset</span>
            <select
              aria-describedby={
                errors.startingWeekdayOffset === undefined
                  ? undefined
                  : "calendar-weekday-offset-error"
              }
              aria-invalid={
                errors.startingWeekdayOffset === undefined ? undefined : true
              }
              className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            </select>
            {errors.startingWeekdayOffset === undefined ? null : (
              <FieldError
                id="calendar-weekday-offset-error"
                message={errors.startingWeekdayOffset}
              />
            )}
          </label>
        </div>
      </fieldset>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Date format template</span>
        <Input
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
      </label>
    </>
  );
}

function CalendarListEditor<
  TItem extends {
    readonly index: number;
    readonly name: string;
    readonly dayCount?: number;
  },
>({
  addButtonLabel,
  error,
  fields,
  items,
  legend,
  onAdd,
  onRemove,
  onUpdate,
}: {
  readonly addButtonLabel: string;
  readonly error?: string;
  readonly fields: readonly {
    readonly key: Extract<keyof TItem, "dayCount" | "name">;
    readonly label: string;
    readonly type: "number" | "text";
  }[];
  readonly items: readonly TItem[];
  readonly legend: string;
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (
    index: number,
    key: Extract<keyof TItem, "dayCount" | "name">,
    value: number | string,
  ) => void;
}): JSX.Element {
  const errorId = `calendar-${legend.toLowerCase()}-error`;

  return (
    <fieldset
      aria-describedby={error === undefined ? undefined : errorId}
      aria-invalid={error === undefined ? undefined : true}
      className="grid gap-3"
    >
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium">{legend}</legend>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          {addButtonLabel}
        </Button>
      </div>
      {error === undefined ? null : <FieldError id={errorId} message={error} />}
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.index}
            className="grid gap-2 sm:grid-cols-[1fr_8rem_2rem]"
          >
            {fields.map((field) =>
              field.type === "number" ? (
                <NumberField
                  key={field.key}
                  label={`${legend} ${index + 1} ${field.label}`}
                  min={1}
                  value={Number(item[field.key])}
                  onChange={(value) => onUpdate(index, field.key, value)}
                />
              ) : (
                <label key={field.key} className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">
                    {legend} {index + 1} {field.label}
                  </span>
                  <Input
                    value={String(item[field.key])}
                    onChange={(event) =>
                      onUpdate(index, field.key, event.currentTarget.value)
                    }
                  />
                </label>
              ),
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end"
              aria-label={`Remove ${legend.toLowerCase()} ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function NumberField({
  describedBy,
  error,
  label,
  max,
  min,
  onChange,
  value,
}: {
  readonly describedBy?: string;
  readonly error?: string;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        aria-describedby={describedBy}
        aria-invalid={error === undefined ? undefined : true}
        max={max}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {error === undefined || describedBy === undefined ? null : (
        <FieldError id={describedBy} message={error} />
      )}
    </label>
  );
}

function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string;
}): JSX.Element {
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function CalendarReadOnlySummary({
  config,
}: {
  readonly config: WorldCalendarConfig;
}): JSX.Element {
  const startingMonth = config.months[config.startingMonthIndex];
  const startingWeekday = config.weekdays[config.startingWeekdayOffset];

  return (
    <div className="grid gap-4">
      <CalendarReadOnlyList
        label="Weekdays"
        items={config.weekdays.map((weekday) => weekday.name)}
      />
      <CalendarReadOnlyList
        label="Months"
        items={config.months.map(
          (month) => `${month.name} (${month.dayCount} days)`,
        )}
      />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Starting date</dt>
          <dd className="text-muted-foreground">
            {startingMonth?.name ?? "Unknown month"} {config.startingDayOfMonth}
            , {config.startingYear}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">
            Starting weekday offset
          </dt>
          <dd className="text-muted-foreground">
            {startingWeekday?.name ?? "Unknown weekday"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Date format template</dt>
          <dd className="text-muted-foreground">{config.dateFormatTemplate}</dd>
        </div>
      </dl>
    </div>
  );
}

function CalendarReadOnlyList({
  items,
  label,
}: {
  readonly items: readonly string[];
  readonly label: string;
}): JSX.Element {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">{label}</h3>
      <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        {items.map((item) => (
          <li key={`${label}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function getCalendarValidationErrors(
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

  if (config.dateFormatTemplate.trim().length < 1) {
    errors.dateFormatTemplate = "Date format template is required.";
  } else if (
    !/\{(?:weekday|month|day|year)\}/.test(config.dateFormatTemplate)
  ) {
    errors.dateFormatTemplate =
      "Date format template must include at least one date token.";
  } else if (
    /\{(?!weekday\}|month\}|day\}|year\})[^{}]+\}/.test(
      config.dateFormatTemplate,
    )
  ) {
    errors.dateFormatTemplate =
      "Date format template contains an unsupported token.";
  }

  return errors;
}

function hasCalendarValidationErrors(
  errors: CalendarValidationErrors,
): boolean {
  return (
    errors.months !== undefined ||
    errors.startingDayOfMonth !== undefined ||
    errors.startingWeekdayOffset !== undefined ||
    errors.weekdays !== undefined ||
    errors.dateFormatTemplate !== undefined
  );
}

function getErrorDescription(error: unknown): string {
  if (isSaveWorldCalendarConfigError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
