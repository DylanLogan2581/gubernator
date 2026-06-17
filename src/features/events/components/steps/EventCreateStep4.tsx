import { type JSX } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { eventInputLimits } from "@/lib/inputLimits";

type EventCreateStep4Props = {
  readonly createCitizenMemories: boolean;
  readonly groupDescription: string;
  readonly memoryText: string;
  readonly onCreateCitizenMemoriesChange: (create: boolean) => void;
  readonly onMemoryTextChange: (text: string) => void;
  readonly isAlreadyActivated?: boolean;
};

export function EventCreateStep4({
  createCitizenMemories,
  groupDescription,
  memoryText,
  onCreateCitizenMemoriesChange,
  onMemoryTextChange,
  isAlreadyActivated = false,
}: EventCreateStep4Props): JSX.Element {
  function handleToggle(checked: boolean): void {
    onCreateCitizenMemoriesChange(checked);
    if (checked && memoryText === "" && groupDescription.trim() !== "") {
      onMemoryTextChange(groupDescription);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Citizen Memories</h3>
        <p className="text-sm text-muted-foreground">
          Optionally record this event as a memory for affected citizens
        </p>
      </div>

      {isAlreadyActivated && (
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          This event has already activated, so its memory settings are locked.
          Citizens who come into scope on later turns still receive the memory
          below; existing memories are never changed.
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="createMemories" className="font-medium">
          Record memory for affected citizens
        </Label>
        <Switch
          id="createMemories"
          checked={createCitizenMemories}
          onCheckedChange={handleToggle}
          disabled={isAlreadyActivated}
        />
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
            disabled={isAlreadyActivated}
          />
          <p className="text-xs text-muted-foreground">
            {memoryText.length} / {eventInputLimits.eventMemoryTextMax}{" "}
            characters
          </p>
          {!isAlreadyActivated && memoryText.trim().length === 0 && (
            <p className="text-xs text-destructive">
              Memory text is required when recording citizen memories.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
