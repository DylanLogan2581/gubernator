import { useQueries, useQuery } from "@tanstack/react-query";

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
  ManagedPopulationInstance,
  ManagedPopulationType,
} from "@/features/managed-populations";
import {
  managedPopulationTypesByWorldQueryOptions,
  managedPopulationInstancesBySettlementQueryOptions,
} from "@/features/managed-populations";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

import { AmountModeToggle, ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

type InstanceWithLocation = {
  readonly id: string;
  readonly settlementId: string;
  readonly name: string;
  readonly typeName: string;
  readonly label: string;
};

/** Editor for the managed_population_change effect. */
export function ManagedPopulationEffectEditor({
  effect,
  index,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
  const typesQuery = useQuery(
    managedPopulationTypesByWorldQueryOptions(worldId),
  );

  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const settlementNameById = new Map(
    (settlementsQuery.data ?? []).map((s) => [s.id, s.name]),
  );

  const instanceQueries = useQueries({
    queries:
      scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            managedPopulationInstancesBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  const allInstances: InstanceWithLocation[] = [];
  if (scopeType === "settlement") {
    instanceQueries.forEach((query, queryIndex) => {
      const settlementId = selectedIds[queryIndex];
      const instances = query.data as ManagedPopulationInstance[] | undefined;
      if (instances !== undefined && Array.isArray(instances)) {
        const settlementName =
          settlementNameById.get(settlementId) ?? settlementId;
        instances.forEach((instance) => {
          allInstances.push({
            id: instance.id,
            settlementId,
            name: instance.name,
            typeName: instance.managedPopulationTypeName,
            label: `${instance.name} [${instance.managedPopulationTypeName}] (${settlementName})`,
          });
        });
      }
    });
  }

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
          {effect.isPercent ? "Percent" : "Amount"}
        </Label>
        <Input
          id={`amount-${index}-${effect.effectType}`}
          type="number"
          placeholder={effect.isPercent ? "e.g., 10 for 10%" : "e.g., 100"}
          value={effect.amountValue ?? ""}
          onChange={(e) =>
            onUpdate({
              ...effect,
              amountValue:
                e.target.value !== "" ? parseFloat(e.target.value) : null,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Positive adds, negative removes.
        </p>
      </div>

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
            <span className="text-sm">All managed populations in scope</span>
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
            <Label htmlFor={`population-type-select-${index}`}>
              Select Type
            </Label>
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
                <SelectTrigger id={`population-type-select-${index}`}>
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
                  <label key={instance.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`managed-population-instance-${index}`}
                      checked={
                        effect.managedPopulationInstanceId === instance.id
                      }
                      onChange={() =>
                        onUpdate({
                          ...effect,
                          managedPopulationInstanceId: instance.id,
                        })
                      }
                    />
                    <span className="text-sm">{instance.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
