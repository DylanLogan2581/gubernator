import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import {
  useBuildingsInScope,
  type BuildingWithLocationInfo,
} from "../../../hooks/useBuildingsInScope";

import { ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for the building_destroyed effect. */
export function BuildingDestroyedEditor({
  effect,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
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
        ) : allBuildings.length === 0 && buildingsLoading ? (
          <p className="text-sm text-muted-foreground">Loading buildings...</p>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
