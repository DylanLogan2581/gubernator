import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";
import type { JSX } from "react";


export function CalendarReadOnlySummary({
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
