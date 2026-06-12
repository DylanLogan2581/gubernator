import { type JSX } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { eventInputLimits } from "@/lib/inputLimits";

type EventCreateStep4Props = {
  readonly createCitizenMemories: boolean;
  readonly memoryText: string;
  readonly onCreateCitizenMemoriesChange: (create: boolean) => void;
  readonly onMemoryTextChange: (text: string) => void;
};

export function EventCreateStep4({
  createCitizenMemories,
  memoryText,
  onCreateCitizenMemoriesChange,
  onMemoryTextChange,
}: EventCreateStep4Props): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="createMemories"
            checked={createCitizenMemories}
            onCheckedChange={(checked) =>
              onCreateCitizenMemoriesChange(checked === true)
            }
          />
          <Label htmlFor="createMemories" className="font-medium">
            Create citizen memories
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Automatically generate memories for affected citizens
        </p>
      </div>

      {createCitizenMemories && (
        <div className="space-y-2">
          <Label htmlFor="memoryText" className="font-medium">
            Memory text
          </Label>
          <Textarea
            id="memoryText"
            placeholder="What should citizens remember about this event?"
            value={memoryText}
            onChange={(e) => onMemoryTextChange(e.target.value)}
            maxLength={eventInputLimits.eventMemoryTextMax}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {memoryText.length} / {eventInputLimits.eventMemoryTextMax} characters
          </p>
        </div>
      )}
    </div>
  );
}
