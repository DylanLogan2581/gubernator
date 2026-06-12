import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EventCreateStep3Props = {
  readonly durationType: "instant" | "sustained";
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly onDurationTypeChange: (type: "instant" | "sustained") => void;
  readonly onDurationTransitionsChange: (trans: number | null) => void;
  readonly onActivationTurnChange: (turn: number) => void;
};

export function EventCreateStep3({
  durationType,
  durationTransitions,
  activationTurn,
  onDurationTypeChange,
  onDurationTransitionsChange,
  onActivationTurnChange,
}: EventCreateStep3Props): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Duration Type</Label>
        <div className="space-y-2">
          <Button
            variant={durationType === "instant" ? "default" : "outline"}
            className="w-full justify-start"
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
            className="w-full justify-start"
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
                e.target.value ? parseInt(e.target.value, 10) : null,
              )
            }
            placeholder="Number of turns"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="activationTurn" className="font-medium">
          Activation Turn
        </Label>
        <Input
          id="activationTurn"
          type="number"
          min="0"
          value={activationTurn}
          onChange={(e) => onActivationTurnChange(parseInt(e.target.value, 10))}
          placeholder="When should this event start?"
        />
        <p className="text-xs text-muted-foreground">
          The event will activate after this turn number completes
        </p>
      </div>
    </div>
  );
}
