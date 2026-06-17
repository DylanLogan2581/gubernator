import { useQueries, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { SearchableResourcePicker } from "@/components/shared/SearchableResourcePicker";
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
import type {
  SettlementBuilding,
  SettlementBuildingWithLocation,
} from "@/features/buildings";
import {
  blueprintsByWorldQueryOptions,
  settlementBuildingsBySettlementQueryOptions,
  settlementBuildingsByNationsQueryOptions,
  settlementBuildingsByWorldQueryOptions,
} from "@/features/buildings";
import type {
  DepositInstance,
  DepositInstanceWithLocation,
} from "@/features/deposits";
import {
  depositInstancesBySettlementQueryOptions,
  depositInstancesByNationsQueryOptions,
  depositInstancesByWorldQueryOptions,
} from "@/features/deposits";
import { jobsByWorldQueryOptions, type JobDefinition } from "@/features/jobs";
import type {
  ManagedPopulationInstance,
  ManagedPopulationType,
} from "@/features/managed-populations";
import {
  managedPopulationTypesByWorldQueryOptions,
  managedPopulationInstancesBySettlementQueryOptions,
} from "@/features/managed-populations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";

type EventEffectType =
  | "building_destroyed"
  | "consumption_multiplier"
  | "deposit_destroyed"
  | "managed_population_change"
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
  resourceMode?: "all" | "select";
  populationType?: "boost" | "loss";
  jobId: string | null;
  jobIds?: string[];
  jobMode?: "all" | "select";
  managedPopulationInstanceId: string | null;
  managedPopulationTypeId: string | null;
  managedPopulationMode?: "all" | "type" | "instance";
  depositInstanceId: string | null;
  depositInstanceIds?: string[];
  settlementBuildingId: string | null;
  settlementBuildingIds?: string[];
  buildingBlueprintMode?: "all" | "select";
  buildingBlueprintIds?: string[];
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
    value: "population_loss",
    label: "Population Loss",
    description:
      "Kill a number of citizens (flat count or percent of living population)",
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
      label: "Population Loss",
      description: "Kill a number of citizens",
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

  // Query for jobs if this is a production_multiplier effect
  const jobsQuery = useQuery(jobsByWorldQueryOptions(worldId));

  // Query for deposits if this is a deposit_destroyed effect
  // For settlement scope: fetch individually per settlement
  const settlementDepositQueries = useQueries({
    queries:
      scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            depositInstancesBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  // For nation/world scope: fetch in bulk
  const nationDepositQueryOptions =
    scopeType === "nation" && selectedIds.length > 0
      ? depositInstancesByNationsQueryOptions(selectedIds)
      : null;
  const nationDepositQuery = useQuery(
    (nationDepositQueryOptions ?? {
      queryKey: ["deposits", "nations-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly DepositInstanceWithLocation[]),
      enabled: false,
    }) as never,
  );

  const worldDepositQueryOptions =
    scopeType === "world" ? depositInstancesByWorldQueryOptions(worldId) : null;
  const worldDepositQuery = useQuery(
    (worldDepositQueryOptions ?? {
      queryKey: ["deposits", "world-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly DepositInstanceWithLocation[]),
      enabled: false,
    }) as never,
  );

  // Query for buildings if this is a building_destroyed effect
  // For settlement scope: fetch individually per settlement
  const settlementBuildingQueries = useQueries({
    queries:
      scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            settlementBuildingsBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  // For nation/world scope: fetch in bulk
  const nationBuildingQueryOptions =
    scopeType === "nation" && selectedIds.length > 0
      ? settlementBuildingsByNationsQueryOptions(selectedIds)
      : null;
  const nationBuildingQuery = useQuery(
    (nationBuildingQueryOptions ?? {
      queryKey: ["buildings", "nations-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly SettlementBuildingWithLocation[]),
      enabled: false,
    }) as never,
  );

  const worldBuildingQueryOptions =
    scopeType === "world"
      ? settlementBuildingsByWorldQueryOptions(worldId)
      : null;
  const worldBuildingQuery = useQuery(
    (worldBuildingQueryOptions ?? {
      queryKey: ["buildings", "world-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly SettlementBuildingWithLocation[]),
      enabled: false,
    }) as never,
  );

  // Query for managed population types for type-targeted effects
  const typesQuery = useQuery(
    managedPopulationTypesByWorldQueryOptions(worldId),
  );

  // Query for building blueprints for blueprint-targeted upkeep effects
  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));

  // Query for managed population instances if this is a managed_population_change effect
  const instanceQueries = useQueries({
    queries:
      effect.effectType === "managed_population_change" &&
      scopeType === "settlement" &&
      selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            managedPopulationInstancesBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  // Pool all deposits from selected settlements with settlement and nation labels
  type DepositWithLocation = {
    readonly id: string;
    readonly settlementId: string;
    readonly settlementName: string;
    readonly nationName: string;
    readonly name: string;
    readonly label: string;
    readonly groupLabel: string;
  };
  const allDeposits: DepositWithLocation[] = [];

  if (scopeType === "settlement") {
    settlementDepositQueries.forEach((query, index) => {
      const settlementId = selectedIds[index];
      const deposits = query.data as DepositInstance[] | undefined;
      if (deposits !== undefined && Array.isArray(deposits)) {
        deposits.forEach((deposit) => {
          allDeposits.push({
            id: deposit.id,
            settlementId,
            settlementName: settlementId,
            nationName: "",
            name: deposit.name,
            label: `${deposit.name} (Settlement: ${settlementId.slice(0, 8)})`,
            groupLabel: `Settlement: ${settlementId.slice(0, 8)}`,
          });
        });
      }
    });
  } else if (scopeType === "nation") {
    const deposits = nationDepositQuery.data as
      | DepositInstanceWithLocation[]
      | undefined;
    if (deposits !== undefined && Array.isArray(deposits)) {
      deposits.forEach((deposit) => {
        allDeposits.push({
          id: deposit.id,
          settlementId: deposit.settlementId,
          settlementName: deposit.settlementName,
          nationName: deposit.nationName,
          name: deposit.name,
          label: `${deposit.name} - ${deposit.settlementName} - ${deposit.nationName}`,
          groupLabel: `${deposit.settlementName}`,
        });
      });
    }
  } else if (scopeType === "world") {
    const deposits = worldDepositQuery.data as
      | DepositInstanceWithLocation[]
      | undefined;
    if (deposits !== undefined && Array.isArray(deposits)) {
      deposits.forEach((deposit) => {
        allDeposits.push({
          id: deposit.id,
          settlementId: deposit.settlementId,
          settlementName: deposit.settlementName,
          nationName: deposit.nationName,
          name: deposit.name,
          label: `${deposit.name} - ${deposit.settlementName} - ${deposit.nationName}`,
          groupLabel: `${deposit.settlementName}`,
        });
      });
    }
  }

  // Pool all buildings from selected settlements, grouped by nation/settlement
  type BuildingWithLocationInfo = {
    readonly id: string;
    readonly settlementId: string;
    readonly settlementName: string;
    readonly nationName: string;
    readonly blueprintName: string;
    readonly label: string;
    readonly groupLabel: string;
  };
  const allBuildings: BuildingWithLocationInfo[] = [];

  if (scopeType === "settlement") {
    settlementBuildingQueries.forEach((query, index) => {
      const settlementId = selectedIds[index];
      const buildings = query.data as SettlementBuilding[] | undefined;
      if (buildings !== undefined && Array.isArray(buildings)) {
        buildings.forEach((building) => {
          allBuildings.push({
            id: building.id,
            settlementId,
            settlementName: settlementId,
            nationName: "",
            blueprintName: building.blueprintName,
            label: `${building.blueprintName} (Settlement: ${settlementId.slice(0, 8)})`,
            groupLabel: `Settlement: ${settlementId.slice(0, 8)}`,
          });
        });
      }
    });
  } else if (scopeType === "nation") {
    const buildings = nationBuildingQuery.data as
      | SettlementBuildingWithLocation[]
      | undefined;
    if (buildings !== undefined && Array.isArray(buildings)) {
      buildings.forEach((building) => {
        allBuildings.push({
          id: building.id,
          settlementId: building.settlementId,
          settlementName: building.settlementName,
          nationName: building.nationName,
          blueprintName: building.blueprintName,
          label: `${building.blueprintName} - ${building.settlementName} - ${building.nationName}`,
          groupLabel: `${building.settlementName}`,
        });
      });
    }
  } else if (scopeType === "world") {
    const buildings = worldBuildingQuery.data as
      | SettlementBuildingWithLocation[]
      | undefined;
    if (buildings !== undefined && Array.isArray(buildings)) {
      buildings.forEach((building) => {
        allBuildings.push({
          id: building.id,
          settlementId: building.settlementId,
          settlementName: building.settlementName,
          nationName: building.nationName,
          blueprintName: building.blueprintName,
          label: `${building.blueprintName} - ${building.settlementName} - ${building.nationName}`,
          groupLabel: `${building.settlementName}`,
        });
      });
    }
  }

  // Pool all managed population instances from selected settlements
  type InstanceWithLocation = {
    readonly id: string;
    readonly settlementId: string;
    readonly name: string;
    readonly typeName: string;
    readonly label: string;
  };
  const allInstances: InstanceWithLocation[] = [];

  if (effect.effectType === "managed_population_change") {
    if (scopeType === "settlement") {
      instanceQueries.forEach((query, index) => {
        const settlementId = selectedIds[index];
        const instances = query.data as ManagedPopulationInstance[] | undefined;
        if (instances !== undefined && Array.isArray(instances)) {
          instances.forEach((instance) => {
            allInstances.push({
              id: instance.id,
              settlementId,
              name: instance.name,
              typeName: instance.managedPopulationTypeName,
              label: `${instance.name} [${instance.managedPopulationTypeName}] (Settlement: ${settlementId.slice(0, 8)})`,
            });
          });
        }
      });
    }
  }

  // Determine display label and whether to show special UIs
  const isModifyResource =
    effect.effectType === "modify_resource" ||
    effect.effectType === "resource_grant" ||
    effect.effectType === "resource_drain";

  const isModifyPopulation =
    effect.effectType === "population_boost" ||
    effect.effectType === "population_loss";

  const isAmountEffect = [
    "resource_grant",
    "resource_drain",
    "population_loss",
    "population_boost",
    "managed_population_change",
    "modify_resource",
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

            {/* Resource target mode toggle and selector */}
            {resourcesQuery.data !== undefined && (
              <div className="space-y-2">
                <Label>Target Resources</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={effect.resourceMode !== "select"}
                      onChange={() =>
                        onUpdate({
                          ...effect,
                          resourceMode: "all",
                          resourceIds: undefined,
                        })
                      }
                    />
                    <span className="text-sm">All Resources</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={effect.resourceMode === "select"}
                      onChange={() =>
                        onUpdate({
                          ...effect,
                          resourceMode: "select",
                          resourceIds: effect.resourceIds ?? [],
                        })
                      }
                    />
                    <span className="text-sm">Select Resources</span>
                  </label>
                </div>

                {effect.resourceMode !== "select" ? (
                  <div className="rounded-md border border-dashed border-muted-foreground bg-muted/20 p-3">
                    <p className="text-sm font-medium">
                      ✓ All {resourcesQuery.data.length} resources selected
                    </p>
                  </div>
                ) : (
                  resourcesQuery.data.length > 0 && (
                    <SearchableResourcePicker
                      resources={resourcesQuery.data.map((r) => ({
                        id: r.id,
                        name: r.name,
                      }))}
                      selectedIds={effect.resourceIds ?? []}
                      onSelectionChange={(ids) =>
                        onUpdate({
                          ...effect,
                          resourceIds: ids,
                        })
                      }
                    />
                  )
                )}

                {resourcesQuery.data.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No resources available
                  </p>
                )}
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
                {effect.isPercent ? "Percent" : "Amount"}{" "}
                {effect.effectType === "population_loss"
                  ? "(citizens to kill)"
                  : "(positive = boost, negative = loss)"}
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

        {effect.effectType === "managed_population_change" && (
          <div className="space-y-2">
            <Label>Target Selection</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={
                    effect.managedPopulationMode === undefined ||
                    effect.managedPopulationMode === "all"
                  }
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      managedPopulationMode: "all",
                      managedPopulationTypeId: null,
                      managedPopulationInstanceId: null,
                    })
                  }
                />
                <span className="text-sm">
                  All managed populations in scope
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effect.managedPopulationMode === "type"}
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      managedPopulationMode: "type",
                      managedPopulationInstanceId: null,
                    })
                  }
                />
                <span className="text-sm">All of a population type</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effect.managedPopulationMode === "instance"}
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      managedPopulationMode: "instance",
                      managedPopulationTypeId: null,
                    })
                  }
                />
                <span className="text-sm">Specific instances</span>
              </label>
            </div>

            {effect.managedPopulationMode === "type" && (
              <div className="space-y-2">
                <Label htmlFor="population-type-select">Select Type</Label>
                {typesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading population types...
                  </p>
                ) : typesQuery.data === undefined ||
                  typesQuery.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No population types available
                  </p>
                ) : (
                  <Select
                    value={effect.managedPopulationTypeId ?? ""}
                    onValueChange={(value) =>
                      onUpdate({
                        ...effect,
                        managedPopulationTypeId: value !== "" ? value : null,
                      })
                    }
                  >
                    <SelectTrigger id="population-type-select">
                      <SelectValue placeholder="Choose a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typesQuery.data.map((type: ManagedPopulationType) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {effect.managedPopulationMode === "instance" && (
              <div className="space-y-2">
                <Label>Select Instances</Label>
                {scopeType !== "settlement" ? (
                  <p className="text-sm text-muted-foreground">
                    Select settlements in step 2 to target instances
                  </p>
                ) : selectedIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No settlements selected
                  </p>
                ) : allInstances.length === 0 &&
                  instanceQueries.some((q) => q.isLoading) ? (
                  <p className="text-sm text-muted-foreground">
                    Loading instances...
                  </p>
                ) : allInstances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No managed populations available in selected settlements
                  </p>
                ) : (
                  <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
                    {allInstances.map((instance) => (
                      <label
                        key={instance.id}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          checked={
                            effect.managedPopulationInstanceId === instance.id
                          }
                          onCheckedChange={(checked) => {
                            onUpdate({
                              ...effect,
                              managedPopulationInstanceId:
                                checked === true ? instance.id : null,
                            });
                          }}
                        />
                        <span className="text-sm">{instance.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
              <>
                <p className="text-sm text-muted-foreground">
                  Multiply job output production. Can optionally be scoped to
                  all jobs or specific jobs.
                </p>

                {/* Job target mode toggle and selector */}
                {jobsQuery.data !== undefined && (
                  <div className="space-y-2 pt-2">
                    <Label>Target Jobs</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={effect.jobMode !== "select"}
                          onChange={() =>
                            onUpdate({
                              ...effect,
                              jobMode: "all",
                              jobIds: undefined,
                            })
                          }
                        />
                        <span className="text-sm">All Jobs</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={effect.jobMode === "select"}
                          onChange={() =>
                            onUpdate({
                              ...effect,
                              jobMode: "select",
                              jobIds: effect.jobIds ?? [],
                            })
                          }
                        />
                        <span className="text-sm">Select Jobs</span>
                      </label>
                    </div>

                    {effect.jobMode === "all" ? (
                      <div className="rounded-md border border-dashed border-muted-foreground bg-muted/20 p-3">
                        <p className="text-sm font-medium">
                          ✓ All {jobsQuery.data.length} jobs selected
                        </p>
                      </div>
                    ) : (
                      jobsQuery.data.length > 0 && (
                        <SearchableResourcePicker
                          resources={jobsQuery.data.map((j: JobDefinition) => ({
                            id: j.id,
                            name: j.name,
                          }))}
                          selectedIds={effect.jobIds ?? []}
                          onSelectionChange={(ids) =>
                            onUpdate({
                              ...effect,
                              jobIds: ids,
                            })
                          }
                        />
                      )
                    )}

                    {jobsQuery.data.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No jobs available
                      </p>
                    )}
                  </div>
                )}

                {jobsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading jobs...
                  </p>
                )}
              </>
            )}
            {effect.effectType === "consumption_multiplier" && (
              <p className="text-sm text-muted-foreground">
                Affects citizen food and water consumption rates.
              </p>
            )}
            {effect.effectType === "upkeep_multiplier" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Affects building upkeep costs.
                </p>

                {/* Building blueprint target mode toggle and selector */}
                {blueprintsQuery.data !== undefined && (
                  <div className="space-y-2 pt-2">
                    <Label>Target Buildings</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={effect.buildingBlueprintMode !== "select"}
                          onChange={() =>
                            onUpdate({
                              ...effect,
                              buildingBlueprintMode: "all",
                              buildingBlueprintIds: undefined,
                            })
                          }
                        />
                        <span className="text-sm">All Buildings</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={effect.buildingBlueprintMode === "select"}
                          onChange={() =>
                            onUpdate({
                              ...effect,
                              buildingBlueprintMode: "select",
                              buildingBlueprintIds:
                                effect.buildingBlueprintIds ?? [],
                            })
                          }
                        />
                        <span className="text-sm">Specific Building Types</span>
                      </label>
                    </div>

                    {effect.buildingBlueprintMode === "all" ? (
                      <div className="rounded-md border border-dashed border-muted-foreground bg-muted/20 p-3">
                        <p className="text-sm font-medium">
                          ✓ All {blueprintsQuery.data.length} building types
                          selected
                        </p>
                      </div>
                    ) : (
                      blueprintsQuery.data.length > 0 && (
                        <SearchableResourcePicker
                          resources={blueprintsQuery.data.map((b) => ({
                            id: b.id,
                            name: b.name,
                          }))}
                          selectedIds={effect.buildingBlueprintIds ?? []}
                          onSelectionChange={(ids) =>
                            onUpdate({
                              ...effect,
                              buildingBlueprintIds: ids,
                            })
                          }
                        />
                      )
                    )}

                    {blueprintsQuery.data.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No building types available
                      </p>
                    )}
                  </div>
                )}

                {blueprintsQuery.isLoading === true && (
                  <p className="text-sm text-muted-foreground">
                    Loading building types...
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {effect.effectType === "deposit_destroyed" && (
          <div className="space-y-2">
            <Label>Deposits to Destroy</Label>
            {scopeType === null ? (
              <p className="text-sm text-muted-foreground">
                Select a scope in step 1 to target deposits
              </p>
            ) : selectedIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {scopeType === "settlement"
                  ? "No settlements selected"
                  : scopeType === "nation"
                    ? "No nations selected"
                    : "No world selected"}
              </p>
            ) : allDeposits.length === 0 &&
              (scopeType === "settlement"
                ? settlementDepositQueries.some((q) => q.isLoading)
                : scopeType === "nation"
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions
                    !!(nationDepositQuery as any).isLoading
                  : // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions
                    !!(worldDepositQuery as any).isLoading) ? (
              <p className="text-sm text-muted-foreground">
                Loading deposits...
              </p>
            ) : allDeposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deposits available in selected {scopeType}
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
                {/* Group deposits by settlement for clarity at scale */}
                {Object.entries(
                  allDeposits.reduce(
                    (acc, deposit) => {
                      const group = deposit.groupLabel;
                      if (!(group in acc)) acc[group] = [];
                      acc[group].push(deposit);
                      return acc;
                    },
                    {} as Record<string, DepositWithLocation[]>,
                  ),
                ).map(([group, groupDeposits]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      {group}
                    </p>
                    <div className="space-y-2 ml-2">
                      {groupDeposits.map((deposit) => (
                        <label
                          key={deposit.id}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={
                              effect.depositInstanceIds?.includes(deposit.id) ??
                              effect.depositInstanceId === deposit.id
                            }
                            onCheckedChange={(checked) => {
                              const currentIds =
                                effect.depositInstanceIds ??
                                (effect.depositInstanceId !== null
                                  ? [effect.depositInstanceId]
                                  : []);
                              const newIds = new Set(currentIds);
                              if (checked === true) {
                                newIds.add(deposit.id);
                              } else if (checked === false) {
                                newIds.delete(deposit.id);
                              }
                              onUpdate({
                                ...effect,
                                depositInstanceIds: Array.from(newIds),
                              });
                            }}
                          />
                          <span className="text-sm">{deposit.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {effect.effectType === "building_destroyed" && (
          <div className="space-y-2">
            <Label>Buildings to Destroy</Label>
            {scopeType === null ? (
              <p className="text-sm text-muted-foreground">
                Select a scope in step 1 to target buildings
              </p>
            ) : selectedIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {scopeType === "settlement"
                  ? "No settlements selected"
                  : scopeType === "nation"
                    ? "No nations selected"
                    : "No world selected"}
              </p>
            ) : allBuildings.length === 0 &&
              (scopeType === "settlement"
                ? settlementBuildingQueries.some((q) => q.isLoading)
                : scopeType === "nation"
                  ? nationBuildingQuery.isLoading
                  : worldBuildingQuery.isLoading) ? (
              <p className="text-sm text-muted-foreground">
                Loading buildings...
              </p>
            ) : allBuildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No buildings available in selected {scopeType}
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
                {/* Group buildings by settlement for clarity at scale */}
                {Object.entries(
                  allBuildings.reduce(
                    (acc, building) => {
                      const group = building.groupLabel;
                      if (!(group in acc)) acc[group] = [];
                      acc[group].push(building);
                      return acc;
                    },
                    {} as Record<string, BuildingWithLocationInfo[]>,
                  ),
                ).map(([group, groupBuildings]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      {group}
                    </p>
                    <div className="space-y-2 ml-2">
                      {groupBuildings.map((building) => (
                        <label
                          key={building.id}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={
                              effect.settlementBuildingIds?.includes(
                                building.id,
                              ) ?? effect.settlementBuildingId === building.id
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
                  </div>
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
      jobMode: undefined,
      managedPopulationInstanceId: null,
      managedPopulationTypeId: null,
      managedPopulationMode: undefined,
      depositInstanceId: null,
      depositInstanceIds: undefined,
      settlementBuildingId: null,
      buildingBlueprintMode: undefined,
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
            No effects configured yet. Add effects to customize the event, or
            leave empty for a narrative-only event.
          </p>
        </div>
      )}
    </div>
  );
}
