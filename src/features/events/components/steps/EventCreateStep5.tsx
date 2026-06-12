import { type JSX } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { eventInputLimits } from "@/lib/inputLimits";

import type { EventDurationType, EventScopeType } from "../../types/eventTypes";

type EventCreateStep5Props = {
  readonly groupName: string;
  readonly groupDescription: string;
  readonly scopeType: EventScopeType;
  readonly effectType: string;
  readonly durationType: EventDurationType;
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly createCitizenMemories: boolean;
  readonly onGroupNameChange: (name: string) => void;
  readonly onGroupDescriptionChange: (desc: string) => void;
};

export function EventCreateStep5({
  groupName,
  groupDescription,
  scopeType,
  effectType,
  durationType,
  durationTransitions,
  activationTurn,
  createCitizenMemories,
  onGroupNameChange,
  onGroupDescriptionChange,
}: EventCreateStep5Props): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Review & Name</h3>
        <p className="text-sm text-muted-foreground">
          Give your event group a name and review the details
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
          {groupDescription.length} / {eventInputLimits.eventGroupDescriptionMax} characters
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-3">
        <h4 className="font-medium">Event Summary</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Scope:</dt>
            <dd className="font-medium capitalize">{scopeType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Effect type:</dt>
            <dd className="font-medium">{effectType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Duration:</dt>
            <dd className="font-medium">
              {durationType === "instant"
                ? "Instant"
                : `${durationTransitions} transitions`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Activation:</dt>
            <dd className="font-medium">After turn {activationTurn}</dd>
          </div>
          {createCitizenMemories && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Memories:</dt>
              <dd className="font-medium">Yes</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
