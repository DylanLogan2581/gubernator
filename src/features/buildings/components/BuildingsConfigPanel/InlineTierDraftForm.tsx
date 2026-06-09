import { useEffect, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import { generateLocalId } from "@/lib/uid";

import { useTierDraftForm } from "../../hooks/useTierDraftForm";
import type { PendingTierDraft } from "../../hooks/useCreateBlueprintWithTiers";
import { TierDraftFields } from "../TierDraftFields";

export default function InlineTierDraftForm({
  activeJobs,
  activeResources,
  defaultTierNumber,
  disabled,
  onAdd,
  onCancel,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly defaultTierNumber: number;
  readonly disabled: boolean;
  readonly onAdd: (draft: PendingTierDraft) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const form = useTierDraftForm();

  useEffect(() => {
    form.setTierNumber(String(defaultTierNumber));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdd(): void {
    const data = form.validate(activeResources, activeJobs);
    if (data === null) return;

    onAdd({
      constructionCostsJson: data.constructionCostsJson,
      effectsJson: data.effectsJson,
      id: generateLocalId(),
      tierNumber: data.tierNumber,
      upkeepCostsJson: data.upkeepCostsJson,
      workerTurnsRequired: data.workerTurnsRequired,
    });
  }

  return (
    <div
      aria-label="Add tier draft"
      className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
      role="group"
    >
      <span className="text-sm font-medium">New tier</span>
      <div className="grid gap-3">
        <TierDraftFields
          activeJobs={activeJobs}
          activeResources={activeResources}
          constructionCosts={form.constructionCosts}
          disabled={disabled}
          effects={form.effects}
          fieldErrors={form.fieldErrors}
          onConstructionCostsChange={form.setConstructionCosts}
          onEffectsChange={form.setEffects}
          onTierNumberChange={(value) => {
            form.setTierNumber(value);
          }}
          onUpkeepCostsChange={form.setUpkeepCosts}
          onWorkerTurnsChange={(value) => {
            form.setWorkerTurns(value);
          }}
          tierNumber={form.tierNumber}
          tierNumberInputId="inline-tier-number"
          upkeepCosts={form.upkeepCosts}
          workerTurns={form.workerTurns}
          workerTurnsInputId="inline-worker-turns-required"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={handleAdd}>
          Add
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
