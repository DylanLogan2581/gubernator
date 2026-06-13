import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { nationsListQueryOptions } from "@/features/nations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

import type { EventDurationType, EventScopeType } from "../../types/eventTypes";

type EventCreateStep5Props = {
  readonly groupName: string;
  readonly groupDescription: string;
  readonly scopeType: EventScopeType;
  readonly selectedIds: string[];
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
  readonly activationTurnRelativeTime?: string;
  readonly createCitizenMemories: boolean;
  readonly worldId: string;
};

export function EventCreateStep5({
  groupName,
  groupDescription,
  scopeType,
  selectedIds,
  effects,
  durationType,
  durationTransitions,
  activationTurn,
  activationTurnCalendarDate,
  activationTurnRelativeTime,
  createCitizenMemories,
  worldId,
}: EventCreateStep5Props): JSX.Element {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));

  // Build lookup maps for names
  const settlementMap = new Map(
    (settlementsQuery.data ?? []).map((s) => [s.id, s]),
  );
  const nationMap = new Map((nationsQuery.data ?? []).map((n) => [n.id, n]));
  const resourceMap = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r]),
  );
  const jobMap = new Map((jobsQuery.data ?? []).map((j) => [j.id, j]));

  // Format scope with named targets
  const getScopeLabel = (): string => {
    if (scopeType === "world") {
      return "Entire world";
    }
    if (scopeType === "nation") {
      const names = selectedIds
        .map((id) => {
          const nation = nationMap.get(id);
          return nation !== undefined ? nation.name : id;
        })
        .sort();
      return names.length > 0 ? names.join(", ") : "No nations selected";
    }
    if (scopeType === "settlement") {
      const names = selectedIds
        .map((id) => {
          const settlement = settlementMap.get(id);
          return settlement !== undefined
            ? `${settlement.name} (${settlement.nationName})`
            : id;
        })
        .sort();
      return names.length > 0 ? names.join(", ") : "No settlements selected";
    }
    return scopeType ?? "Unknown";
  };

  // Format effect label based on type and targets
  const formatEffect = (
    effect: EventCreateStep5Props["effects"][number],
  ): string => {
    const typeName = effect.effectType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    let targetLabel = "";

    if (effect.resourceId !== null && effect.resourceId.length > 0) {
      const resource = resourceMap.get(effect.resourceId);
      targetLabel = resource !== undefined ? resource.name : "Unknown resource";
    } else if (effect.jobId !== null && effect.jobId.length > 0) {
      const job = jobMap.get(effect.jobId);
      targetLabel = job !== undefined ? job.name : "Unknown job";
    } else if (
      effect.managedPopulationInstanceId !== null &&
      effect.managedPopulationInstanceId.length > 0
    ) {
      targetLabel = "Managed population";
    } else if (
      effect.depositInstanceId !== null &&
      effect.depositInstanceId.length > 0
    ) {
      targetLabel = "Deposit";
    }

    let valueLabel = "";
    if (effect.isPercent) {
      if (effect.multiplierValue !== null) {
        valueLabel = `${Math.round(effect.multiplierValue * 100)}%`;
      } else if (effect.amountValue !== null) {
        valueLabel = `${Math.round(effect.amountValue)}%`;
      }
    } else {
      if (effect.multiplierValue !== null) {
        valueLabel = `x${effect.multiplierValue.toFixed(2)}`;
      } else if (effect.amountValue !== null) {
        valueLabel = `${effect.amountValue}`;
      }
    }

    const parts = [typeName];
    if (targetLabel.length > 0) {
      parts.push(targetLabel);
    }
    if (valueLabel.length > 0) {
      parts.push(valueLabel);
    }

    return parts.join(" • ");
  };

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
            <dd className="font-medium">{getScopeLabel()}</dd>
          </div>

          <div className="space-y-2">
            <dt className="text-muted-foreground">Effects:</dt>
            <dd className="space-y-1">
              {effects.map((effect) => {
                const key = `${effect.effectType}-${effect.resourceId ?? effect.jobId ?? effect.managedPopulationInstanceId ?? effect.depositInstanceId ?? "default"}`;
                return (
                  <div key={key} className="text-xs text-foreground">
                    • {formatEffect(effect)}
                  </div>
                );
              })}
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
              <dt className="text-muted-foreground">Activation:</dt>
              <dd className="font-medium">{activationTurn}</dd>
            </div>
            {activationTurnCalendarDate !== undefined &&
              activationTurnCalendarDate !== null &&
              activationTurnCalendarDate.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted-foreground">Date:</dt>
                  <dd className="text-xs font-medium">
                    {activationTurnCalendarDate}
                  </dd>
                </div>
              )}
            {activationTurnRelativeTime !== undefined &&
              activationTurnRelativeTime !== null &&
              activationTurnRelativeTime.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted-foreground">Time:</dt>
                  <dd className="text-xs font-medium">
                    {activationTurnRelativeTime}
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
