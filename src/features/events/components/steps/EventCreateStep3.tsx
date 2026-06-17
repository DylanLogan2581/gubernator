import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  worldCalendarConfigQueryOptions,
  WorldDatePicker,
} from "@/features/calendar";
import {
  type CalendarDateInput,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

type EventCreateStep3Props = {
  readonly worldId: string;
  readonly currentTurnNumber: number;
  readonly durationType: "instant" | "sustained";
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly onDurationTypeChange: (type: "instant" | "sustained") => void;
  readonly onDurationTransitionsChange: (trans: number | null) => void;
  readonly onActivationTurnChange: (turn: number) => void;
};

export function EventCreateStep3({
  worldId,
  currentTurnNumber,
  durationType,
  durationTransitions,
  activationTurn,
  onDurationTypeChange,
  onDurationTransitionsChange,
  onActivationTurnChange,
}: EventCreateStep3Props): JSX.Element {
  const calendarConfigQuery = useQuery(
    worldCalendarConfigQueryOptions(worldId),
  );

  const calendarConfig = calendarConfigQuery.data;

  // Convert activation turn to calendar date for the picker
  let activationTurnDate: CalendarDateInput | null = null;
  if (
    calendarConfig !== null &&
    calendarConfig !== undefined &&
    activationTurn > 0
  ) {
    try {
      const resolved = resolveTurnCalendarDate(calendarConfig, activationTurn);
      activationTurnDate = {
        year: resolved.year,
        monthIndex: resolved.monthIndex,
        dayOfMonth: resolved.dayOfMonth,
      };
    } catch {
      // Silently fail if turn number is invalid
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Duration Type</Label>
        <div className="space-y-2">
          <Button
            variant={durationType === "instant" ? "default" : "outline"}
            className="w-full justify-start h-auto py-3"
            onClick={() => onDurationTypeChange("instant")}
          >
            <div className="text-left">
              <div className="font-medium">Instant</div>
              <div className="text-xs text-muted-foreground">
                Effect applies once
              </div>
            </div>
          </Button>

          <Button
            variant={durationType === "sustained" ? "default" : "outline"}
            className="w-full justify-start h-auto py-3"
            onClick={() => onDurationTypeChange("sustained")}
          >
            <div className="text-left">
              <div className="font-medium">Sustained</div>
              <div className="text-xs text-muted-foreground">
                Effect persists for multiple turns
              </div>
            </div>
          </Button>
        </div>
      </div>

      {durationType === "sustained" && (
        <div className="space-y-2">
          <Label htmlFor="durationTransitions" className="font-medium">
            Duration (transitions)
          </Label>
          <Input
            id="durationTransitions"
            type="number"
            min="1"
            value={durationTransitions ?? ""}
            onChange={(e) =>
              onDurationTransitionsChange(
                e.target.value.length > 0 ? parseInt(e.target.value, 10) : null,
              )
            }
            placeholder="Number of turns"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="font-medium">Activation Turn</Label>
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Current turn:{" "}
            <span className="font-semibold text-foreground">
              {currentTurnNumber}
            </span>
          </p>
        </div>
        {calendarConfig !== null && calendarConfig !== undefined ? (
          <WorldDatePicker
            config={calendarConfig}
            currentTurnNumber={currentTurnNumber}
            value={activationTurnDate}
            onTurnNumberChange={onActivationTurnChange}
            label="Select activation date"
          />
        ) : (
          <Input
            type="number"
            min={currentTurnNumber}
            value={activationTurn}
            onChange={(e) =>
              onActivationTurnChange(parseInt(e.target.value, 10))
            }
            placeholder="When should this event start?"
          />
        )}
        <p className="text-xs text-muted-foreground">
          The event will activate after this turn number completes
        </p>
        {activationTurn < currentTurnNumber && activationTurn > 0 && (
          <p className="text-xs text-amber-600">
            Activation turn must be ≥ current turn (turn {currentTurnNumber})
          </p>
        )}
      </div>
    </div>
  );
}
