import { MultiplierInput, ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for the consumption_multiplier effect. */
export function ConsumptionMultiplierEditor({
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

      <div className="space-y-2">
        <MultiplierInput effect={effect} index={index} onUpdate={onUpdate} />
        <p className="text-sm text-muted-foreground">
          Affects citizen food and water consumption rates.
        </p>
      </div>
    </>
  );
}
