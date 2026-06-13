import { type JSX } from "react";

import type { EventDurationType, EventScopeType } from "../../types/eventTypes";

type EventCreateStep5Props = {
  readonly groupName: string;
  readonly groupDescription: string;
  readonly scopeType: EventScopeType;
  readonly effects: Array<{
    effectType: string;
    isPercent: boolean;
    amountValue: number | null;
    multiplierValue: number | null;
    resourceId: string | null;
    jobId: string | null;
    managedPopulationInstanceId: string | null;
    depositInstanceId: string | null;
  }>;
  readonly durationType: EventDurationType;
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly activationTurnCalendarDate?: string;
  readonly createCitizenMemories: boolean;
};

export function EventCreateStep5({
  groupName,
  groupDescription,
  scopeType,
  effects,
  durationType,
  durationTransitions,
  activationTurn,
  activationTurnCalendarDate,
  createCitizenMemories,
}: EventCreateStep5Props): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Review</h3>
        <p className="text-sm text-muted-foreground">
          Review your event configuration before creating
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        <h4 className="font-semibold">Event Details</h4>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Name:</dt>
            <dd className="font-medium">{groupName}</dd>
          </div>
          {groupDescription.length > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Description:</dt>
              <dd className="font-medium">{groupDescription}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        <h4 className="font-semibold">Configuration Summary</h4>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Scope:</dt>
            <dd className="font-medium capitalize">{scopeType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Effects:</dt>
            <dd className="font-medium">
              {effects.length} effect{effects.length === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Duration:</dt>
            <dd className="font-medium">
              {durationType === "instant"
                ? "Instant"
                : `${durationTransitions} transition${durationTransitions === 1 ? "" : "s"}`}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Activation Turn:</dt>
              <dd className="font-medium">{activationTurn}</dd>
            </div>
            {activationTurnCalendarDate !== undefined &&
              activationTurnCalendarDate !== null && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted-foreground">Date:</dt>
                  <dd className="text-xs font-medium">
                    {activationTurnCalendarDate}
                  </dd>
                </div>
              )}
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
