// Stepper + "all turns" toggle for the turn log's default single-turn view.
// Dates are computed locally from the world's calendar config — no extra
// query is needed to list every turn.

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  formatCalendarDateShort,
  resolveTurnCalendarDate,
} from "@/features/calendar";
import type { WorldCalendarConfig } from "@/features/calendar";

import type { JSX } from "react";

type TurnPickerProps = {
  readonly calendarConfig: WorldCalendarConfig | null;
  readonly latestTurnNumber: number | null;
  readonly onChange: (turn: number | "all") => void;
  readonly selectedTurn: number | "all" | null;
};

export function TurnPicker({
  calendarConfig,
  latestTurnNumber,
  onChange,
  selectedTurn,
}: TurnPickerProps): JSX.Element {
  const isAll = selectedTurn === "all";
  const turnNumber =
    typeof selectedTurn === "number" ? selectedTurn : (latestTurnNumber ?? 1);

  function turnLabel(turn: number): string {
    if (calendarConfig === null) {
      return `Turn ${turn}`;
    }
    const date = resolveTurnCalendarDate(calendarConfig, turn);
    return `Turn ${turn} · ${formatCalendarDateShort(date, { shortDateFormatTemplate: calendarConfig.shortDateFormatTemplate })}`;
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Previous turn"
        variant="outline"
        size="icon"
        className="size-8"
        disabled={isAll || turnNumber <= 1}
        onClick={() => onChange(turnNumber - 1)}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>

      <NativeSelect
        aria-label="Selected turn"
        value={isAll ? "all" : String(turnNumber)}
        onChange={(e) =>
          onChange(e.target.value === "all" ? "all" : Number(e.target.value))
        }
        className="h-8 min-w-44 text-sm"
      >
        {isAll ? null : (
          <option value={String(turnNumber)}>{turnLabel(turnNumber)}</option>
        )}
        <option value="all">All turns</option>
      </NativeSelect>

      <Button
        aria-label="Next turn"
        variant="outline"
        size="icon"
        className="size-8"
        disabled={
          isAll || latestTurnNumber === null || turnNumber >= latestTurnNumber
        }
        onClick={() => onChange(turnNumber + 1)}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
