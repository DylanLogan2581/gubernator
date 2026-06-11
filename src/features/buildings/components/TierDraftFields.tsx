import { type JSX } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";

import {
  type CostRowState,
  type EffectRowState,
  type TierFormErrors,
} from "../utils/tierEditorUtils";

import { CostEditor, EffectsEditor } from "./TierEditorFields";

export function TierDraftFields({
  activeJobs,
  activeResources,
  constructionCosts,
  disabled,
  effects,
  fieldErrors,
  onConstructionCostsChange,
  onEffectsChange,
  onTierNumberChange,
  onUpkeepCostsChange,
  onWorkerTurnsChange,
  tierNumber,
  tierNumberInputId,
  upkeepCosts,
  workerTurns,
  workerTurnsInputId,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly constructionCosts: readonly CostRowState[];
  readonly disabled: boolean;
  readonly effects: readonly EffectRowState[];
  readonly fieldErrors: Readonly<TierFormErrors>;
  readonly onConstructionCostsChange: (rows: CostRowState[]) => void;
  readonly onEffectsChange: (rows: EffectRowState[]) => void;
  readonly onTierNumberChange: (value: string) => void;
  readonly onUpkeepCostsChange: (rows: CostRowState[]) => void;
  readonly onWorkerTurnsChange: (value: string) => void;
  readonly tierNumber: string;
  readonly tierNumberInputId: string;
  readonly upkeepCosts: readonly CostRowState[];
  readonly workerTurns: string;
  readonly workerTurnsInputId: string;
}): JSX.Element {
  return (
    <>
      <div className="grid gap-1">
        <Label htmlFor={tierNumberInputId}>Tier number</Label>
        <Input
          id={tierNumberInputId}
          aria-invalid={fieldErrors.tierNumber !== undefined}
          disabled={disabled}
          inputMode="numeric"
          placeholder="1"
          value={tierNumber}
          onChange={(e) => {
            onTierNumberChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.tierNumber !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.tierNumber}</p>
        ) : null}
      </div>
      <div className="grid gap-1">
        <Label htmlFor={workerTurnsInputId}>Worker turns required</Label>
        <Input
          id={workerTurnsInputId}
          aria-invalid={fieldErrors.workerTurnsRequired !== undefined}
          disabled={disabled}
          inputMode="numeric"
          placeholder="0"
          value={workerTurns}
          onChange={(e) => {
            onWorkerTurnsChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.workerTurnsRequired !== undefined ? (
          <p className="text-xs text-destructive">
            {fieldErrors.workerTurnsRequired}
          </p>
        ) : null}
      </div>
      <CostEditor
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.constructionCostsJson}
        label="Construction costs"
        rows={constructionCosts}
        onChange={onConstructionCostsChange}
      />
      <CostEditor
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.upkeepCostsJson}
        label="Upkeep costs"
        rows={upkeepCosts}
        onChange={onUpkeepCostsChange}
      />
      <EffectsEditor
        activeJobs={activeJobs}
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.effectsJson}
        rows={effects}
        onChange={onEffectsChange}
      />
    </>
  );
}
