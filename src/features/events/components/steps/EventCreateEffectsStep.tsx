import { useQueries, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SettlementBuilding } from "@/features/buildings";
import { settlementBuildingsBySettlementQueryOptions } from "@/features/buildings";
import type { DepositInstance } from "@/features/deposits";
import { depositInstancesBySettlementQueryOptions } from "@/features/deposits";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";

type EventEffectType =
  | "building_damage"
  | "building_destroyed"
  | "consumption_multiplier"
  | "deposit_destroyed"
  | "managed_population_change"
  | "modify_population"
  | "modify_resource"
  | "population_boost"
  | "population_loss"
  | "production_multiplier"
  | "resource_drain"
  | "resource_grant"
  | "upkeep_multiplier";

type EffectData = {
  effectType: string;
  isPercent: boolean;
  amountValue: number | null;
  multiplierValue: number | null;
  resourceId: string | null;
  resourceIds?: string[];
  populationType?: "boost" | "loss";
  jobId: number | null;
  managedPopulationInstanceId: string | null;
  depositInstanceId: string | null;
  settlementBuildingId: string | null;
  settlementBuildingIds?: string[];
  _id?: string;
};

type EventCreateEffectsStepProps = {
  readonly effects: EffectData[];
  readonly onEffectsChange: (effects: EffectData[]) => void;
  readonly worldId: string;
  readonly selectedIds: string[];
  readonly scopeType: "world" | "nation" | "settlement" | null;
};

// Multiplier effect types and their targets:
// - production_multiplier: job output (optionally scoped by job or building)
// - consumption_multiplier: citizen food/water consumption
// - upkeep_multiplier: building upkeep costs only (managed populations have no upkeep)
// Note: managed population upkeep multiplier not added because managed populations
// (animals, etc.) do not incur upkeep costs in the simulation.
const EFFECT_TYPE_OPTIONS: Array<{
  value: EventEffectType;
  label: string;
  description: string;
}> = [
  {
    value: "modify_resource",
    label: "Modify Resource",
    description:
      "Add or remove resources (positive for grant, negative for drain)",
  },
  {
    value: "modify_population",
    label: "Modify Population",
    description:
      "Increase or decrease population (positive for boost, negative for loss)",
  },
  {
    value: "managed_population_change",
    label: "Managed Population Change",
    description: "Adjust managed population (animals, etc.)",
  },
  {
    value: "production_multiplier",
    label: "Job Production Multiplier",
    description:
      "Multiply job output production (optionally scoped by job or building)",
  },
  {
    value: "consumption_multiplier",
    label: "Citizen Consumption Multiplier",
    description: "Multiply citizen food and water consumption",
  },
  {
    value: "upkeep_multiplier",
    label: "Building Upkeep Multiplier",
    description: "Multiply building upkeep costs",
  },
  {
    value: "building_damage",
    label: "Building Damage",
    description: "Damage buildings",
  },
  {
    value: "building_destroyed",
    label: "Building Destroyed",
    description: "Destroy specific buildings",
  },
  {
    value: "deposit_destroyed",
    label: "Deposit Destroyed",
    description: "Destroy existing deposits",
  },
];

// Reference map for all effect types (for editing existing effects)
const ALL_EFFECT_TYPES: Record<string, { label: string; description: string }> =
  {
    resource_grant: {
      label: "Modify Resource",
      description: "Add or remove resources",
    },
    resource_drain: {
      label: "Modify Resource",
      description: "Add or remove resources",
    },
    population_boost: {
      label: "Modify Population",
      description: "Increase or decrease population",
    },
    population_loss: {
      label: "Modify Population",
      description: "Increase or decrease population",
    },
    ...Object.fromEntries(
      EFFECT_TYPE_OPTIONS.map((opt) => [
        opt.value,
        { label: opt.label, description: opt.description },
      ]),
    ),
  };

function EffectEditor({
  effect,
  onUpdate,
  onRemove,
  worldId,
  selectedIds,
  scopeType,
}: {
  readonly effect: EffectData;
  readonly onUpdate: (updated: EffectData) => void;
  readonly onRemove: () => void;
  readonly worldId: string;
  readonly selectedIds: string[];
  readonly scopeType: "world" | "nation" | "settlement" | null;
}): JSX.Element {
  // Query for resources if this is a modify_resource or resource effect
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  // Query for deposits if this is a deposit_destroyed effect
  const depositQueries = useQueries({
    queries:
      scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            depositInstancesBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  // Query for buildings if this is a building_destroyed effect
  const buildingQueries = useQueries({
    queries:
      scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            settlementBuildingsBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  // Pool all deposits from selected settlements with settlement labels
  const allDeposits: Array<{
    readonly id: string;
    readonly settlementId: string;
    readonly name: string;
    readonly label: string;
  }> = [];

  if (scopeType === "settlement") {
    depositQueries.forEach((query, index) => {
      const settlementId = selectedIds[index];
      const deposits = query.data as DepositInstance[] | undefined;
      if (deposits !== undefined && Array.isArray(deposits)) {
        deposits.forEach((deposit) => {
          allDeposits.push({
            id: deposit.id,
            settlementId,
            name: deposit.name,
            label: `${deposit.name} (Settlement: ${settlementId.slice(0, 8)})`,
          });
        });
      }
    });
  }

  // Pool all buildings from selected settlements, grouped by nation/settlement
  type BuildingWithLocation = {
    readonly id: string;
    readonly settlementId: string;
    readonly blueprintName: string;
    readonly label: string;
    readonly groupLabel: string;
  };
  const allBuildings: BuildingWithLocation[] = [];

  if (scopeType === "settlement") {
    buildingQueries.forEach((query, index) => {
      const settlementId = selectedIds[index];
      const buildings = query.data as SettlementBuilding[] | undefined;
      if (buildings !== undefined && Array.isArray(buildings)) {
        buildings.forEach((building) => {
          allBuildings.push({
            id: building.id,
            settlementId,
            blueprintName: building.blueprintName,
            label: `${building.blueprintName} (Settlement: ${settlementId.slice(0, 8)})`,
            groupLabel: `Settlement: ${settlementId.slice(0, 8)}`,
          });
        });
      }
    });
  }

  // Determine display label and whether to show special UIs
  const isModifyResource =
    effect.effectType === "modify_resource" ||
    effect.effectType === "resource_grant" ||
    effect.effectType === "resource_drain";

  const isModifyPopulation =
    effect.effectType === "modify_population" ||
    effect.effectType === "population_boost" ||
    effect.effectType === "population_loss";

  const isAmountEffect = [
    "resource_grant",
    "resource_drain",
    "population_loss",
    "population_boost",
    "managed_population_change",
    "modify_resource",
    "modify_population",
  ].includes(effect.effectType);

  const isMultiplierEffect = [
    "production_multiplier",
    "consumption_multiplier",
    "upkeep_multiplier",
  ].includes(effect.effectType);

  // Get label from options or mapping
  let displayLabel = "";
  const option = EFFECT_TYPE_OPTIONS.find(
    (opt) => opt.value === effect.effectType,
  );
  if (option !== undefined) {
    displayLabel = option.label;
  } else if (isModifyResource) {
    displayLabel = "Modify Resource";
  } else if (isModifyPopulation) {
    displayLabel = "Modify Population";
  } else if (ALL_EFFECT_TYPES[effect.effectType] !== undefined) {
    displayLabel = ALL_EFFECT_TYPES[effect.effectType]?.label ?? "";
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{displayLabel}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isModifyResource && (
          <>
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!effect.isPercent}
                    onChange={() => onUpdate({ ...effect, isPercent: false })}
                  />
                  <span className="text-sm">Flat amount</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={effect.isPercent}
                    onChange={() => onUpdate({ ...effect, isPercent: true })}
                  />
                  <span className="text-sm">Percent of current</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`amount-${effect.effectType}`}>
                {effect.isPercent ? "Percent" : "Amount"} (positive = grant,
                negative = drain)
              </Label>
              <Input
                id={`amount-${effect.effectType}`}
                type="number"
                placeholder={
                  effect.isPercent ? "e.g., 10 for 10%" : "e.g., 100 or -50"
                }
                value={effect.amountValue ?? ""}
                onChange={(e) =>
                  onUpdate({
                    ...effect,
                    amountValue:
                      e.target.value !== "" ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>

            {/* Resource multi-selector */}
            {resourcesQuery.data !== undefined && (
              <div className="space-y-2">
                <Label>Resources</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {resourcesQuery.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No resources available
                    </p>
                  ) : (
                    resourcesQuery.data.map((resource) => (
                      <label
                        key={resource.id}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          checked={
                            effect.resourceIds?.includes(resource.id) ?? false
                          }
                          onCheckedChange={(checked) => {
                            const currentIds =
                              effect.resourceIds ??
                              (effect.resourceId !== null
                                ? [effect.resourceId]
                                : []);
                            const newIds = new Set(currentIds);
                            if (checked === true) {
                              newIds.add(resource.id);
                            } else if (checked === false) {
                              newIds.delete(resource.id);
                            }
                            onUpdate({
                              ...effect,
                              resourceIds: Array.from(newIds),
                            });
                          }}
                        />
                        <span className="text-sm">{resource.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {resourcesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading resources...
              </p>
            )}
          </>
        )}

        {isModifyPopulation && (
          <>
            <div className="space-y-2">
              <Label>Population Change Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={effect.populationType !== "loss"}
                    onChange={() =>
                      onUpdate({ ...effect, populationType: "boost" })
                    }
                  />
                  <span className="text-sm">Boost (positive amount)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={effect.populationType === "loss"}
                    onChange={() =>
                      onUpdate({ ...effect, populationType: "loss" })
                    }
                  />
                  <span className="text-sm">Loss (positive amount → loss)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`amount-${effect.effectType}`}>
                Amount (always enter as positive)
              </Label>
              <Input
                id={`amount-${effect.effectType}`}
                type="number"
                placeholder="e.g., 100"
                value={effect.amountValue ?? ""}
                onChange={(e) =>
                  onUpdate({
                    ...effect,
                    amountValue:
                      e.target.value !== "" ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
          </>
        )}

        {isAmountEffect && !isModifyResource && !isModifyPopulation && (
          <>
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!effect.isPercent}
                    onChange={() => onUpdate({ ...effect, isPercent: false })}
                  />
                  <span className="text-sm">Flat amount</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={effect.isPercent}
                    onChange={() => onUpdate({ ...effect, isPercent: true })}
                  />
                  <span className="text-sm">Percent of current</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`amount-${effect.effectType}`}>
                {effect.isPercent ? "Percent" : "Amount"}
              </Label>
              <Input
                id={`amount-${effect.effectType}`}
                type="number"
                placeholder={
                  effect.isPercent ? "e.g., 10 for 10%" : "e.g., 100"
                }
                value={effect.amountValue ?? ""}
                onChange={(e) =>
                  onUpdate({
                    ...effect,
                    amountValue:
                      e.target.value !== "" ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
          </>
        )}

        {isMultiplierEffect && (
          <div className="space-y-2">
            <Label htmlFor={`multiplier-${effect.effectType}`}>
              Multiplier (e.g., 1.2 for 20% increase, 0.8 for 20% decrease)
            </Label>
            <Input
              id={`multiplier-${effect.effectType}`}
              type="number"
              placeholder="1.0"
              step="0.1"
              value={effect.multiplierValue ?? ""}
              onChange={(e) =>
                onUpdate({
                  ...effect,
                  multiplierValue:
                    e.target.value !== "" ? parseFloat(e.target.value) : null,
                })
              }
            />
            {effect.effectType === "production_multiplier" && (
              <p className="text-sm text-muted-foreground">
                Affects job output production. Can optionally be scoped to a
                specific job or building type by setting job ID or building
                blueprint ID in the event payload.
              </p>
            )}
            {effect.effectType === "consumption_multiplier" && (
              <p className="text-sm text-muted-foreground">
                Affects citizen food and water consumption rates.
              </p>
            )}
            {effect.effectType === "upkeep_multiplier" && (
              <p className="text-sm text-muted-foreground">
                Affects building upkeep costs for all buildings in the
                settlement.
              </p>
            )}
          </div>
        )}

        {effect.effectType === "deposit_destroyed" && (
          <div className="space-y-2">
            <Label>Deposits to Destroy</Label>
            {scopeType !== "settlement" ? (
              <p className="text-sm text-muted-foreground">
                Select settlements in step 2 to target deposits
              </p>
            ) : selectedIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No settlements selected
              </p>
            ) : allDeposits.length === 0 &&
              depositQueries.some((q) => q.isLoading) ? (
              <p className="text-sm text-muted-foreground">
                Loading deposits...
              </p>
            ) : allDeposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deposits available in selected settlements
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {allDeposits.map((deposit) => (
                  <label key={deposit.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={effect.depositInstanceId === deposit.id}
                      onCheckedChange={(checked) => {
                        onUpdate({
                          ...effect,
                          depositInstanceId:
                            checked === true ? deposit.id : null,
                        });
                      }}
                    />
                    <span className="text-sm">{deposit.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {effect.effectType === "building_destroyed" && (
          <div className="space-y-2">
            <Label>Buildings to Destroy</Label>
            {scopeType !== "settlement" ? (
              <p className="text-sm text-muted-foreground">
                Select settlements in step 2 to target buildings
              </p>
            ) : selectedIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No settlements selected
              </p>
            ) : allBuildings.length === 0 &&
              buildingQueries.some((q) => q.isLoading) ? (
              <p className="text-sm text-muted-foreground">
                Loading buildings...
              </p>
            ) : allBuildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No buildings available in selected settlements
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {allBuildings.map((building) => (
                  <label key={building.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        effect.settlementBuildingIds?.includes(building.id) ??
                        effect.settlementBuildingId === building.id
                      }
                      onCheckedChange={(checked) => {
                        const currentIds =
                          effect.settlementBuildingIds ??
                          (effect.settlementBuildingId !== null
                            ? [effect.settlementBuildingId]
                            : []);
                        const newIds = new Set(currentIds);
                        if (checked === true) {
                          newIds.add(building.id);
                        } else if (checked === false) {
                          newIds.delete(building.id);
                        }
                        onUpdate({
                          ...effect,
                          settlementBuildingIds: Array.from(newIds),
                        });
                      }}
                    />
                    <span className="text-sm">{building.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EventCreateEffectsStep({
  effects,
  onEffectsChange,
  worldId,
  selectedIds,
  scopeType,
}: EventCreateEffectsStepProps): JSX.Element {
  const [selectedType, setSelectedType] = useState<EventEffectType | "">("");

  const addEffect = (): void => {
    if (selectedType === "") return;
    const newEffect: EffectData = {
      effectType: selectedType,
      isPercent: false,
      amountValue: null,
      multiplierValue: null,
      resourceId: null,
      jobId: null,
      managedPopulationInstanceId: null,
      depositInstanceId: null,
      settlementBuildingId: null,
    };
    onEffectsChange([...effects, newEffect]);
    setSelectedType("");
  };

  const updateEffect = (index: number, updated: EffectData): void => {
    const newEffects = [...effects];
    newEffects[index] = updated;
    onEffectsChange(newEffects);
  };

  const removeEffect = (index: number): void => {
    onEffectsChange(effects.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="effect-type-select" className="text-base font-semibold">
          Add Effect
        </Label>
        <div className="flex gap-2">
          <Select
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as EventEffectType)}
          >
            <SelectTrigger id="effect-type-select" className="flex-1">
              <SelectValue placeholder="Select an effect type..." />
            </SelectTrigger>
            <SelectContent>
              {EFFECT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addEffect} disabled={selectedType === ""}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {effects.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {effects.length} effect{effects.length === 1 ? "" : "s"} configured
          </p>
          <div className="space-y-3">
            {effects.map((effect, idx) => (
              <EffectEditor
                key={effect._id ?? idx}
                effect={effect}
                onUpdate={(updated) => updateEffect(idx, updated)}
                onRemove={() => removeEffect(idx)}
                worldId={worldId}
                selectedIds={selectedIds}
                scopeType={scopeType}
              />
            ))}
          </div>
        </div>
      )}

      {effects.length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No effects configured yet. Add at least one effect above to
            continue.
          </p>
        </div>
      )}
    </div>
  );
}
