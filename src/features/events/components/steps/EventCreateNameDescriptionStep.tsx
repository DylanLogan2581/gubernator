import { type JSX } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { eventInputLimits } from "@/lib/inputLimits";

type EventCreateNameDescriptionStepProps = {
  readonly groupName: string;
  readonly groupDescription: string;
  readonly onGroupNameChange: (name: string) => void;
  readonly onGroupDescriptionChange: (desc: string) => void;
};

export function EventCreateNameDescriptionStep({
  groupName,
  groupDescription,
  onGroupNameChange,
  onGroupDescriptionChange,
}: EventCreateNameDescriptionStepProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Event Basics</h3>
        <p className="text-sm text-muted-foreground">
          Give your event group a name and optional description
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="groupName" className="font-medium">
          Group Name
        </Label>
        <Input
          id="groupName"
          placeholder="e.g., Spring Plague Outbreak"
          value={groupName}
          onChange={(e) => onGroupNameChange(e.target.value)}
          maxLength={eventInputLimits.eventGroupNameMax}
        />
        <p className="text-xs text-muted-foreground">
          {groupName.length} / {eventInputLimits.eventGroupNameMax} characters
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="groupDescription" className="font-medium">
          Description (optional)
        </Label>
        <Textarea
          id="groupDescription"
          placeholder="Additional context for this event"
          value={groupDescription}
          onChange={(e) => onGroupDescriptionChange(e.target.value)}
          maxLength={eventInputLimits.eventGroupDescriptionMax}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          {groupDescription.length} /{" "}
          {eventInputLimits.eventGroupDescriptionMax} characters
        </p>
      </div>
    </div>
  );
}
