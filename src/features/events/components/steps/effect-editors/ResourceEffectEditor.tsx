import { useQuery } from "@tanstack/react-query";

import { SearchableResourcePicker } from "@/components/shared/SearchableResourcePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";

import { AmountModeToggle, ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for modify_resource / resource_grant / resource_drain effects. */
export function ResourceEffectEditor({
  effect,
  index,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  return (
    <>
      <ZeroTargetAlert
        effect={effect}
        worldId={worldId}
        scopeType={scopeType}
        selectedIds={selectedIds}
      />

      <AmountModeToggle effect={effect} onUpdate={onUpdate} />

      <div className="space-y-2">
        <Label htmlFor={`amount-${index}-${effect.effectType}`}>
          {effect.isPercent ? "Percent" : "Amount"} (positive = grant, negative
          = drain)
        </Label>
        <Input
          id={`amount-${index}-${effect.effectType}`}
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
        <p className="text-sm text-muted-foreground">Loading resources...</p>
      )}
    </>
  );
}
