import { CalendarIcon } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  CalendarDateInput,
  TurnCalendarConfig,
} from "../utils/turnCalendarDates";

export type { CalendarDateInput };

type WorldDatePickerProps = {
  readonly config: TurnCalendarConfig;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly onChange: (date: CalendarDateInput) => void;
  readonly value: CalendarDateInput | null;
};

function dateLabel(
  value: CalendarDateInput | null,
  config: TurnCalendarConfig,
): string {
  if (value === null) return "Pick a date";
  const month = config.months.find((m) => m.index === value.monthIndex);
  const monthName = month?.name ?? String(value.monthIndex);
  return `${monthName} ${String(value.dayOfMonth)}, Year ${String(value.year)}`;
}

export function WorldDatePicker({
  config,
  disabled = false,
  label = "Pick a date",
  onChange,
  value,
}: WorldDatePickerProps): JSX.Element {
  const selectedMonth = config.months.find(
    (m) => m.index === (value?.monthIndex ?? config.months[0]?.index ?? 0),
  );
  const dayCount = selectedMonth?.dayCount ?? 1;

  const currentYear = value?.year ?? config.startingYear;
  const currentMonthIndex = value?.monthIndex ?? config.months[0]?.index ?? 0;
  const currentDay = value?.dayOfMonth ?? 1;

  function handleYearChange(raw: string): void {
    const year = parseInt(raw, 10);
    if (isNaN(year)) return;
    const newDay = currentDay;
    const targetMonth = config.months.find(
      (m) => m.index === currentMonthIndex,
    );
    const clampedDay =
      targetMonth !== undefined ? Math.min(newDay, targetMonth.dayCount) : 1;
    onChange({ year, monthIndex: currentMonthIndex, dayOfMonth: clampedDay });
  }

  function handleMonthChange(raw: string): void {
    const monthIndex = parseInt(raw, 10);
    const targetMonth = config.months.find((m) => m.index === monthIndex);
    if (targetMonth === undefined) return;
    const clampedDay = Math.min(currentDay, targetMonth.dayCount);
    onChange({ year: currentYear, monthIndex, dayOfMonth: clampedDay });
  }

  function handleDayChange(raw: string): void {
    const dayOfMonth = parseInt(raw, 10);
    if (isNaN(dayOfMonth)) return;
    onChange({ year: currentYear, monthIndex: currentMonthIndex, dayOfMonth });
  }

  // Offer a reasonable year range: 20 years before/after current selection.
  const yearSpan = 20;
  const yearMin = currentYear - yearSpan;
  const yearMax = currentYear + yearSpan;
  const years: number[] = [];
  for (let y = yearMin; y <= yearMax; y++) {
    years.push(y);
  }

  const days: number[] = [];
  for (let d = 1; d <= dayCount; d++) {
    days.push(d);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon aria-hidden="true" className="mr-2 h-4 w-4 shrink-0" />
          {dateLabel(value, config)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="grid gap-2">
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Month
            </span>
            <Select
              value={String(currentMonthIndex)}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.months.map((month) => (
                  <SelectItem key={month.index} value={String(month.index)}>
                    {month.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Day
            </span>
            <Select value={String(currentDay)} onValueChange={handleDayChange}>
              <SelectTrigger aria-label="Day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {String(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Year
            </span>
            <Select
              value={String(currentYear)}
              onValueChange={handleYearChange}
            >
              <SelectTrigger aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {String(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
