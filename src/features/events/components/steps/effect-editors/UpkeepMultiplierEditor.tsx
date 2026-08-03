import { useQuery } from "@tanstack/react-query";

import { SearchableResourcePicker } from "@/components/shared/SearchableResourcePicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { blueprintsByWorldQueryOptions } from "@/features/buildings";

import {
  useBuildingsInScope,
  type BuildingWithLocationInfo,
} from "../../../hooks/useBuildingsInScope";

import { MultiplierInput, ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for the upkeep_multiplier effect (multiplier + building targeting). */
export function UpkeepMultiplierEditor({
  effect,
  index,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));

  const { buildings: allBuildings, isLoading: buildingsLoading } =
    useBuildingsInScope({ worldId, scopeType, selectedIds });

  return (
    <>
      <ZeroTargetAlert
        effect={effect}
        worldId={worldId}
        scopeType={scopeType}
        selectedIds={selectedIds}
      />

      <div className="space-y-2">
        <MultiplierInput effect={effect} index={index} onUpdate={onUpdate} />

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
                  checked={
                    effect.buildingBlueprintMode !== "select" &&
                    effect.buildingBlueprintMode !== "instance"
                  }
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      buildingBlueprintMode: "all",
                      buildingBlueprintIds: undefined,
                      buildingInstanceIds: undefined,
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
                      buildingBlueprintIds: effect.buildingBlueprintIds ?? [],
                      buildingInstanceIds: undefined,
                    })
                  }
                />
                <span className="text-sm">Specific Building Types</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effect.buildingBlueprintMode === "instance"}
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      buildingBlueprintMode: "instance",
                      buildingInstanceIds: effect.buildingInstanceIds ?? [],
                      buildingBlueprintIds: undefined,
                    })
                  }
                />
                <span className="text-sm">Specific Buildings</span>
              </label>
            </div>

            {effect.buildingBlueprintMode === "all" ||
            effect.buildingBlueprintMode === undefined ||
            effect.buildingBlueprintMode === null ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                ✓ All {blueprintsQuery.data.length} building types selected
              </p>
            ) : effect.buildingBlueprintMode === "select" ? (
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
            ) : scopeType === null ? (
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
            ) : allBuildings.length === 0 && buildingsLoading ? (
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
                              effect.buildingInstanceIds?.includes(
                                building.id,
                              ) ?? false
                            }
                            onCheckedChange={(checked) => {
                              const currentIds =
                                effect.buildingInstanceIds ?? [];
                              const newIds = new Set(currentIds);
                              if (checked === true) {
                                newIds.add(building.id);
                              } else if (checked === false) {
                                newIds.delete(building.id);
                              }
                              onUpdate({
                                ...effect,
                                buildingInstanceIds: Array.from(newIds),
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

            {effect.buildingBlueprintMode === "select" &&
              blueprintsQuery.data.length === 0 && (
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
      </div>
    </>
  );
}
