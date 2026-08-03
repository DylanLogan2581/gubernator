import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AmountModeToggle, ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for population_loss / population_boost effects. */
export function PopulationEffectEditor({
  effect,
  index,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
  return (
    <>
      <ZeroTargetAlert
        effect={effect}
        worldId={worldId}
        scopeType={scopeType}
        selectedIds={selectedIds}
      />

      {effect.effectType === "population_loss" && (
        <AmountModeToggle effect={effect} onUpdate={onUpdate} />
      )}

      <div className="space-y-2">
        <Label htmlFor={`amount-${index}-${effect.effectType}`}>
          {effect.effectType === "population_loss"
            ? "Citizens to kill"
            : "Citizens to add"}
        </Label>
        <Input
          id={`amount-${index}-${effect.effectType}`}
          type="number"
          placeholder={
            effect.effectType === "population_loss"
              ? "e.g., 100"
              : effect.isPercent
                ? "e.g., 10 for 10%"
                : "e.g., 5"
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
        {effect.effectType === "population_loss" && (
          <p className="text-xs text-muted-foreground">
            Positive number. For population gain use the Population Gain effect.
          </p>
        )}
        {effect.effectType === "population_boost" && (
          <p className="text-xs text-muted-foreground">
            Positive number, applied each turn the event is active.
          </p>
        )}
      </div>
    </>
  );
}
