import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type EventCreateStep1Props = {
  readonly scopeType: "world" | "nation" | "settlement" | null;
  readonly onScopeTypeChange: (
    type: "world" | "nation" | "settlement"
  ) => void;
};

export function EventCreateStep1({
  scopeType,
  onScopeTypeChange,
}: EventCreateStep1Props): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="scope" className="text-base font-semibold">
          Event Scope
        </Label>
        <p className="text-sm text-muted-foreground">
          Who does this event affect?
        </p>
      </div>

      <div className="space-y-2">
        <Button
          variant={scopeType === "world" ? "default" : "outline"}
          className="w-full justify-start"
          onClick={() => onScopeTypeChange("world")}
        >
          <div className="text-left">
            <div className="font-medium">Entire World</div>
            <div className="text-xs text-muted-foreground">
              Affects all inhabitants
            </div>
          </div>
        </Button>

        <Button
          variant={scopeType === "nation" ? "default" : "outline"}
          className="w-full justify-start"
          onClick={() => onScopeTypeChange("nation")}
        >
          <div className="text-left">
            <div className="font-medium">Nation(s)</div>
            <div className="text-xs text-muted-foreground">
              Select one or more nations
            </div>
          </div>
        </Button>

        <Button
          variant={scopeType === "settlement" ? "default" : "outline"}
          className="w-full justify-start"
          onClick={() => onScopeTypeChange("settlement")}
        >
          <div className="text-left">
            <div className="font-medium">Settlement(s)</div>
            <div className="text-xs text-muted-foreground">
              Select one or more settlements
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}
