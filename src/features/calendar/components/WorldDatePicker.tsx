import { CalendarIcon } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import {
  calendarDateToTurnNumber,
  formatRelativeTurnDifference,
  getRelativeTurnDifference,
  resolveTurnCalendarDate,
  type CalendarDateInput,
  type TurnCalendarConfig,
} from "../utils/turnCalendarDates";

export type { CalendarDateInput };

type WorldDatePickerProps = {
  readonly config: TurnCalendarConfig;
  readonly currentTurnNumber: number;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly onTurnNumberChange: (turnNumber: number) => void;
  readonly value: CalendarDateInput | null;
};

export function WorldDatePicker({
  config,
  currentTurnNumber,
  disabled = false,
  label = "Pick a date",
  onTurnNumberChange,
  value,
}: WorldDatePickerProps): JSX.Element {
  // Resolve current date from turn number
  // For turn 0, clamp to turn 1 for display purposes
  const displayTurnNumber = Math.max(currentTurnNumber, 1);
  let todayDate: CalendarDateInput;
  let todayWeekday: string;
  try {
    const resolved = resolveTurnCalendarDate(config, displayTurnNumber);
    todayDate = {
      year: resolved.year,
      monthIndex: resolved.monthIndex,
      dayOfMonth: resolved.dayOfMonth,
    };
    todayWeekday = resolved.weekdayName;
  } catch {
    // Fallback if turn number resolution fails
    todayDate = {
      year: config.startingYear,
      monthIndex: config.months[0]?.index ?? 0,
      dayOfMonth: 1,
    };
    todayWeekday = config.weekdays[0]?.name ?? "Unknown";
  }

  // Use provided value or default to today
  const currentYear = value?.year ?? todayDate.year;
  const currentMonthIndex = value?.monthIndex ?? todayDate.monthIndex;
  const currentDay = value?.dayOfMonth ?? todayDate.dayOfMonth;

  const selectedMonth = config.months.find(
    (m) => m.index === currentMonthIndex,
  );
  const dayCount = selectedMonth?.dayCount ?? 1;

  // Resolve selected date for weekday display and relative time
  let selectedWeekday: string;
  let relativeTimeDisplay: string;
  try {
    const selectedTurnNumber = calendarDateToTurnNumber(config, {
      year: currentYear,
      monthIndex: currentMonthIndex,
      dayOfMonth: currentDay,
    });
    const resolved = resolveTurnCalendarDate(config, selectedTurnNumber);
    selectedWeekday = resolved.weekdayName;
    // For turn 0, clamp to turn 1 for relative time calculation
    const diff = getRelativeTurnDifference(
      config,
      displayTurnNumber,
      selectedTurnNumber,
    );
    relativeTimeDisplay = formatRelativeTurnDifference(diff);
  } catch {
    selectedWeekday = "Invalid";
    relativeTimeDisplay = "Invalid";
  }

  function emitChange(date: CalendarDateInput): void {
    try {
      const turnNumber = calendarDateToTurnNumber(config, date);
      onTurnNumberChange(turnNumber);
    } catch {
      // Invalid date, don't emit
    }
  }

  function handleMonthChange(raw: string): void {
    const monthIndex = parseInt(raw, 10);
    const targetMonth = config.months.find((m) => m.index === monthIndex);
    if (targetMonth === undefined) return;
    const clampedDay = Math.min(currentDay, targetMonth.dayCount);
    emitChange({ year: currentYear, monthIndex, dayOfMonth: clampedDay });
  }

  function handleDayChange(raw: string): void {
    const dayOfMonth = parseInt(raw, 10);
    if (isNaN(dayOfMonth) || dayOfMonth < 1) return;
    const selectedMonth = config.months.find(
      (m) => m.index === currentMonthIndex,
    );
    if (selectedMonth === undefined) return;
    if (dayOfMonth > selectedMonth.dayCount) return;
    emitChange({
      year: currentYear,
      monthIndex: currentMonthIndex,
      dayOfMonth,
    });
  }

  function handleYearChange(raw: string): void {
    const year = parseInt(raw, 10);
    if (isNaN(year)) return;
    const targetMonth = config.months.find(
      (m) => m.index === currentMonthIndex,
    );
    const clampedDay =
      targetMonth !== undefined
        ? Math.min(currentDay, targetMonth.dayCount)
        : 1;
    emitChange({ year, monthIndex: currentMonthIndex, dayOfMonth: clampedDay });
  }

  // Generate day array for current month
  const days: number[] = [];
  for (let d = 1; d <= dayCount; d++) {
    days.push(d);
  }

  const isToday =
    currentYear === todayDate.year &&
    currentMonthIndex === todayDate.monthIndex &&
    currentDay === todayDate.dayOfMonth;

  const monthName = selectedMonth?.name ?? "Unknown";
  const displayLabel = `${monthName} ${currentDay}, Year ${currentYear}${isToday ? " (today)" : ""}`;

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
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid gap-3">
          {/* Horizontal date inputs */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Month
              </label>
              <Select
                value={String(currentMonthIndex)}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger aria-label="Month" className="w-full">
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
            <div className="w-20">
              <label className="text-xs font-medium text-muted-foreground">
                Day
              </label>
              <Select
                value={String(currentDay)}
                onValueChange={handleDayChange}
              >
                <SelectTrigger aria-label="Day" className="w-full">
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
            <div className="w-24">
              <label className="text-xs font-medium text-muted-foreground">
                Year
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={String(currentYear)}
                onChange={(e) => handleYearChange(e.currentTarget.value)}
                aria-label="Year"
                className="w-full"
              />
            </div>
          </div>

          {/* Weekday and relative time display */}
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Weekday:</span>
              <span className="text-sm font-medium">{selectedWeekday}</span>
            </div>
            <div className="mt-1 text-center text-xs text-muted-foreground">
              {relativeTimeDisplay}
            </div>
          </div>

          {/* Today marker */}
          {!isToday && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => emitChange(todayDate)}
              className="w-full text-xs"
            >
              Jump to today ({todayWeekday})
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
