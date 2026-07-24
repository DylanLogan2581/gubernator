import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type EducationLevel } from "@/features/education";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { useTierDraftForm } from "../../hooks/useTierDraftForm";
import { updateTierMutationOptions } from "../../mutations/buildingsMutations";
import {
  tierCostsToState,
  tierEffectsToState,
} from "../../utils/tierEditorUtils";
import { TierDraftFields } from "../TierDraftFields";

import type { BuildingBlueprintTier } from "../../types/buildingTypes";

export function EditTierDialog({
  activeEducationLevels,
  activeJobs,
  activeResources,
  queryClient,
  tier,
  worldId,
  onClose,
}: {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly queryClient: QueryClient;
  readonly tier: BuildingBlueprintTier;
  readonly worldId: string;
  readonly onClose: () => void;
}): JSX.Element {
  const updateMutation = useMutation(
    updateTierMutationOptions({ queryClient }),
  );
  // Initial values only — the render site keys this dialog by `tier.id`, so
  // switching tiers remounts and re-seeds the form.
  const form = useTierDraftForm({
    constructionCosts: tierCostsToState(tier.constructionCostsJson),
    effects: tierEffectsToState(tier.effectsJson),
    tierNumber: String(tier.tierNumber),
    upkeepCosts: tierCostsToState(tier.upkeepCostsJson),
    workerTurns: String(tier.workerTurnsRequired),
  });

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const data = form.validate(
      activeResources,
      activeJobs,
      activeEducationLevels,
    );
    if (data === null) return;

    try {
      await updateMutation.mutateAsync({
        constructionCostsJson: data.constructionCostsJson ?? [],
        effectsJson: data.effectsJson ?? [],
        tierId: tier.id,
        upkeepCostsJson: data.upkeepCostsJson ?? [],
        workerTurnsRequired: data.workerTurnsRequired,
      });
      notifyMutationSuccess("Tier saved.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to save tier.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          aria-label="Edit tier"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit tier {tier.tierNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <TierDraftFields
              activeEducationLevels={activeEducationLevels}
              activeJobs={activeJobs}
              activeResources={activeResources}
              constructionCosts={form.constructionCosts}
              disabled={updateMutation.isPending}
              effects={form.effects}
              fieldErrors={form.fieldErrors}
              onConstructionCostsChange={form.setConstructionCosts}
              onEffectsChange={form.setEffects}
              onTierNumberChange={form.setTierNumber}
              onUpkeepCostsChange={form.setUpkeepCosts}
              onWorkerTurnsChange={form.setWorkerTurns}
              tierNumber={form.tierNumber}
              tierNumberInputId="edit-tier-number"
              upkeepCosts={form.upkeepCosts}
              workerTurns={form.workerTurns}
              workerTurnsInputId="edit-worker-turns-required"
              worldId={worldId}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
