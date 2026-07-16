import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useEffect, type FormEvent, type JSX } from "react";

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
import { createTierMutationOptions } from "../../mutations/buildingsMutations";
import { TierDraftFields } from "../TierDraftFields";

import type { BuildingBlueprintTier } from "../../types/buildingTypes";

export function AddTierDialog({
  activeEducationLevels,
  activeJobs,
  activeResources,
  blueprintId,
  queryClient,
  tiers,
  worldId,
  onClose,
}: {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly blueprintId: string;
  readonly queryClient: QueryClient;
  readonly tiers: readonly BuildingBlueprintTier[];
  readonly worldId: string;
  readonly onClose: () => void;
}): JSX.Element {
  const createMutation = useMutation(
    createTierMutationOptions({ queryClient }),
  );
  const form = useTierDraftForm();

  useEffect(() => {
    const nextTierNumber =
      tiers.length > 0 ? Math.max(...tiers.map((t) => t.tierNumber)) + 1 : 1;
    form.setTierNumber(String(nextTierNumber));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await createMutation.mutateAsync({
        blueprintId,
        constructionCostsJson: data.constructionCostsJson,
        effectsJson: data.effectsJson,
        tierNumber: data.tierNumber,
        upkeepCostsJson: data.upkeepCostsJson,
        workerTurnsRequired: data.workerTurnsRequired,
      });
      notifyMutationSuccess("Tier created.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to create tier.");
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
          aria-label="Add tier"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Add tier</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <TierDraftFields
              activeEducationLevels={activeEducationLevels}
              activeJobs={activeJobs}
              activeResources={activeResources}
              constructionCosts={form.constructionCosts}
              disabled={createMutation.isPending}
              effects={form.effects}
              fieldErrors={form.fieldErrors}
              onConstructionCostsChange={form.setConstructionCosts}
              onEffectsChange={form.setEffects}
              onTierNumberChange={form.setTierNumber}
              onUpkeepCostsChange={form.setUpkeepCosts}
              onWorkerTurnsChange={form.setWorkerTurns}
              tierNumber={form.tierNumber}
              tierNumberInputId="add-tier-number"
              upkeepCosts={form.upkeepCosts}
              workerTurns={form.workerTurns}
              workerTurnsInputId="add-worker-turns-required"
              worldId={worldId}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={createMutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
