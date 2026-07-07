import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
import { type JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  worldCalendarConfigQueryOptions,
  type WorldCalendarConfig,
} from "@/features/calendar";
import { depositTypesByWorldQueryOptions } from "@/features/deposits";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { nationsListQueryOptions } from "@/features/nations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { eventInputLimits } from "@/lib/inputLimits";
import {
  formatCalendarDate,
  resolveTurnCalendarDate,
} from "@/shared/turnCalendarPrimitives";

import { useBuildingsInScope } from "../../hooks/useBuildingsInScope";
import { useDepositsInScope } from "../../hooks/useDepositsInScope";
import {
  computeEffectImpact,
  computeForecastTimeline,
  type EffectImpactCategory,
  type ForecastEffectTurnEntry,
} from "../../utils/effectImpact";

import type { EventDurationType, EventScopeType } from "../../types/eventTypes";

/** A single per-turn memory being drafted in the wizard. */
export type EventMemoryDraft = {
  readonly turnOffset: number;
  readonly text: string;
};

type EventCreateForecastStepEffect = {
  effectType: string;
  isPercent: boolean;
  amountValue: number | null;
  multiplierValue: number | null;
  resourceId: string | null;
  jobId: string | null;
  managedPopulationInstanceId: string | null;
  managedPopulationMode?: "all" | "type" | "instance";
  depositInstanceId: string | null;
  depositInstanceIds?: string[];
  depositTypeId?: string | null;
  depositDestroyedMode?: "instance" | "type";
  settlementBuildingId?: string | null;
  settlementBuildingIds?: string[];
  buildingBlueprintMode?: "all" | "select" | "instance";
  buildingInstanceIds?: string[];
};

type EventCreateForecastStepProps = {
  readonly groupName: string;
  readonly groupDescription: string;
  readonly scopeType: EventScopeType;
  readonly selectedIds: string[];
  readonly effects: EventCreateForecastStepEffect[];
  readonly durationType: EventDurationType;
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly worldId: string;
  readonly memories: readonly EventMemoryDraft[];
  readonly onMemoriesChange: (memories: readonly EventMemoryDraft[]) => void;
  readonly isAlreadyActivated?: boolean;
};

function categoryLabel(category: EffectImpactCategory): string {
  switch (category) {
    case "settlements":
      return "settlement";
    case "buildings":
      return "building";
    case "deposits":
      return "deposit";
    case "populations":
      return "population";
  }
}

function effectTypeName(effectType: string): string {
  return effectType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTurnEntry(
  effect: EventCreateForecastStepEffect,
  entry: ForecastEffectTurnEntry,
): string | null {
  if (!entry.appliesThisTurn) return null;

  const typeName = effectTypeName(effect.effectType);

  if (entry.kind === "one_time") {
    if (effect.effectType === "deposit_discovered") {
      return typeName;
    }
    const count = entry.targetCount ?? 0;
    return `${count} ${typeName.toLowerCase()}`;
  }

  if (entry.kind === "repeating_rate") {
    if (effect.isPercent) {
      const rate =
        effect.multiplierValue !== null
          ? Math.round(effect.multiplierValue * 100)
          : effect.amountValue !== null
            ? Math.round(effect.amountValue)
            : null;
      return rate !== null
        ? `${typeName}: ${rate}% each turn`
        : `${typeName} each turn`;
    }
    if (effect.multiplierValue !== null) {
      return `${typeName}: ×${effect.multiplierValue.toFixed(2)} each turn`;
    }
    return `${typeName} each turn`;
  }

  // repeating_flat
  if (entry.perTurnAmount !== null) {
    const sign = entry.perTurnAmount > 0 ? "+" : "";
    return `${typeName}: ${sign}${entry.perTurnAmount}`;
  }
  return typeName;
}

export function EventCreateForecastStep({
  groupName,
  groupDescription,
  scopeType,
  selectedIds,
  effects,
  durationType,
  durationTransitions,
  activationTurn,
  worldId,
  memories,
  onMemoriesChange,
  isAlreadyActivated = false,
}: EventCreateForecastStepProps): JSX.Element {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const calendarConfigQuery = useQuery(
    worldCalendarConfigQueryOptions(worldId),
  );

  const settlementMap = new Map(
    (settlementsQuery.data ?? []).map((s) => [s.id, s]),
  );
  const nationMap = new Map((nationsQuery.data ?? []).map((n) => [n.id, n]));
  const resourceMap = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r]),
  );
  const jobMap = new Map((jobsQuery.data ?? []).map((j) => [j.id, j]));

  const needsBuildingNames = effects.some(
    (e) => e.buildingBlueprintMode === "instance",
  );
  const { buildings: buildingsInScope } = useBuildingsInScope({
    worldId,
    scopeType,
    selectedIds,
    enabled: needsBuildingNames,
  });
  const buildingLabelById = new Map(
    buildingsInScope.map((b) => [b.id, b.label]),
  );

  const needsDepositTypeNames = effects.some(
    (e) => e.depositDestroyedMode === "type",
  );
  const depositTypesQuery = useQuery(depositTypesByWorldQueryOptions(worldId));
  const depositTypeNameById = new Map(
    (depositTypesQuery.data ?? []).map((t) => [t.id, t.name]),
  );
  const { deposits: depositsInScope } = useDepositsInScope({
    worldId,
    scopeType,
    selectedIds,
    enabled: needsDepositTypeNames,
  });

  const matchingDepositCounts = effects.map((effect) =>
    effect.depositDestroyedMode === "type" &&
    effect.depositTypeId !== null &&
    effect.depositTypeId !== undefined
      ? depositsInScope.filter((d) => d.depositTypeId === effect.depositTypeId)
          .length
      : undefined,
  );

  const settlements = settlementsQuery.data ?? [];
  const effectsWithDepositCounts = effects.map((effect, index) => ({
    ...effect,
    matchingDepositCount: matchingDepositCounts[index],
  }));

  const effectImpacts = effectsWithDepositCounts.map((effect) =>
    computeEffectImpact(effect, scopeType, selectedIds, settlements),
  );
  const hasZeroTargets = effectImpacts.some(
    (impact) => impact !== null && impact.count === 0,
  );

  const forecast = computeForecastTimeline(
    effectsWithDepositCounts,
    scopeType,
    selectedIds,
    settlements,
    durationType,
    durationTransitions,
    activationTurn,
  );

  const getScopeLabel = (): string => {
    if (scopeType === "world") {
      return "Entire world";
    }
    if (scopeType === "nation") {
      const names = selectedIds
        .map((id) => nationMap.get(id)?.name ?? id)
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
    return scopeType;
  };

  const formatEffect = (
    effect: EventCreateForecastStepEffect,
    index: number,
  ): string => {
    const typeName = effectTypeName(effect.effectType);

    let targetLabel = "";
    if (
      effect.depositDestroyedMode === "type" &&
      effect.depositTypeId !== null &&
      effect.depositTypeId !== undefined
    ) {
      const depositTypeName =
        depositTypeNameById.get(effect.depositTypeId) ?? "Unknown type";
      const count = matchingDepositCounts[index] ?? 0;
      targetLabel = `All ${depositTypeName} deposits in ${getScopeLabel()} (currently ${count})`;
    } else if (effect.resourceId !== null && effect.resourceId.length > 0) {
      targetLabel =
        resourceMap.get(effect.resourceId)?.name ?? "Unknown resource";
    } else if (effect.jobId !== null && effect.jobId.length > 0) {
      targetLabel = jobMap.get(effect.jobId)?.name ?? "Unknown job";
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
    } else if (
      effect.buildingBlueprintMode === "instance" &&
      effect.buildingInstanceIds !== undefined &&
      effect.buildingInstanceIds.length > 0
    ) {
      targetLabel = effect.buildingInstanceIds
        .map((id) => buildingLabelById.get(id) ?? id)
        .join(", ");
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
    if (targetLabel.length > 0) parts.push(targetLabel);
    if (valueLabel.length > 0) parts.push(valueLabel);
    return parts.join(" • ");
  };

  const calendarConfig: WorldCalendarConfig | null | undefined =
    calendarConfigQuery.data;

  const dateLabelForTurn = (turnNumber: number): string | null => {
    if (calendarConfig === null || calendarConfig === undefined) return null;
    try {
      const resolved = resolveTurnCalendarDate(calendarConfig, turnNumber);
      return formatCalendarDate(resolved, {
        dateFormatTemplate: calendarConfig.dateFormatTemplate,
      });
    } catch {
      return null;
    }
  };

  const setMemoryText = (turnOffset: number, text: string): void => {
    const exists = memories.some((m) => m.turnOffset === turnOffset);
    if (exists) {
      onMemoriesChange(
        memories.map((m) => (m.turnOffset === turnOffset ? { ...m, text } : m)),
      );
    } else {
      onMemoriesChange([...memories, { turnOffset, text }]);
    }
  };

  const removeMemory = (turnOffset: number): void => {
    onMemoriesChange(memories.filter((m) => m.turnOffset !== turnOffset));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Forecast & Memories</h3>
        <p className="text-sm text-muted-foreground">
          Review the turn-by-turn impact, then optionally record a citizen
          memory for any turn.
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
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Scope:</dt>
            <dd className="font-medium">{getScopeLabel()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Duration:</dt>
            <dd className="font-medium">
              {durationType === "instant"
                ? "Instant"
                : `${durationTransitions} turn${durationTransitions === 1 ? "" : "s"}`}
            </dd>
          </div>
          <div className="space-y-2">
            <dt className="text-muted-foreground">Effects:</dt>
            <dd className="space-y-1">
              {effects.length === 0 ? (
                <span className="text-xs text-muted-foreground">None</span>
              ) : (
                effects.map((effect, index) => {
                  const key = `${effect.effectType}-${index}`;
                  const impact = effectImpacts[index] ?? null;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 text-xs text-foreground"
                    >
                      <span>• {formatEffect(effect, index)}</span>
                      {impact !== null && (
                        <span
                          className={`shrink-0 tabular-nums ${
                            impact.count === 0
                              ? "font-medium text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {impact.count === 0 && "⚠ "}
                          {impact.count} {categoryLabel(impact.category)}
                          {impact.count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </dd>
          </div>
        </dl>
      </div>

      {hasZeroTargets && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Zero-target effects</AlertTitle>
          <AlertDescription>
            One or more effects resolve to zero targets and will have no impact.
            Review scope and effect configuration before creating.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <h4 className="font-semibold">Turn-by-turn forecast</h4>
        <div className="space-y-3">
          {forecast.turns.map((turnRow) => {
            const dateLabel = dateLabelForTurn(turnRow.turnNumber);
            const memory = memories.find(
              (m) => m.turnOffset === turnRow.turnOffset,
            );
            const lines = turnRow.entries
              .map((entry) =>
                formatTurnEntry(effects[entry.effectIndex], entry),
              )
              .filter((line): line is string => line !== null);

            return (
              <div
                key={turnRow.turnOffset}
                className="space-y-2 rounded-lg border p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    Turn {turnRow.turnNumber}
                  </p>
                  {dateLabel !== null && (
                    <p className="text-xs text-muted-foreground">{dateLabel}</p>
                  )}
                </div>
                {lines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No effects apply this turn.
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}

                <div className="pt-1">
                  {memory === undefined ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isAlreadyActivated}
                      onClick={() => setMemoryText(turnRow.turnOffset, "")}
                    >
                      <Plus className="h-3 w-3" />
                      Add memory
                    </Button>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Citizen memory for this turn
                      </Label>
                      <Textarea
                        value={memory.text}
                        onChange={(e) =>
                          setMemoryText(turnRow.turnOffset, e.target.value)
                        }
                        maxLength={eventInputLimits.eventMemoryTextMax}
                        rows={2}
                        disabled={isAlreadyActivated}
                        placeholder="What should citizens remember about this turn?"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {memory.text.length} /{" "}
                          {eventInputLimits.eventMemoryTextMax} characters
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isAlreadyActivated}
                          onClick={() => removeMemory(turnRow.turnOffset)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {forecast.totals.some(
          (total) =>
            total.kind === "repeating_flat" && total.grandTotal !== null,
        ) && (
          <div className="rounded-lg bg-muted p-3 text-xs">
            <p className="mb-1 font-semibold">Totals</p>
            <div className="space-y-1">
              {forecast.totals.map((total) => {
                if (total.kind === "repeating_rate") return null;
                const effect = effects[total.effectIndex];
                if (effect === undefined || total.grandTotal === null) {
                  return null;
                }
                const sign = total.grandTotal > 0 ? "+" : "";
                return (
                  <div
                    key={total.effectIndex}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span>{effectTypeName(effect.effectType)}</span>
                    <span className="tabular-nums">
                      {total.kind === "one_time"
                        ? `${total.grandTotal} total`
                        : `${sign}${total.grandTotal} total`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
