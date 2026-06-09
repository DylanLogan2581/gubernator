import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  createBlueprintMutationOptions,
  createTierMutationOptions,
} from "../mutations/buildingsMutations";
import {
  type CreateBlueprintInput,
  type TierCostEntryInput,
  type TierEffectInput,
} from "../schemas/buildingSchemas";

export type PendingTierDraft = {
  readonly id: string;
  readonly tierNumber: number;
  readonly workerTurnsRequired?: number;
  readonly constructionCostsJson?: TierCostEntryInput[];
  readonly upkeepCostsJson?: TierCostEntryInput[];
  readonly effectsJson?: TierEffectInput[];
};

export function useCreateBlueprintWithTiers(): {
  submit: (
    blueprintInput: CreateBlueprintInput,
    pendingTiers: readonly PendingTierDraft[],
  ) => Promise<void>;
  isCreating: boolean;
} {
  const queryClient = useQueryClient();
  const createBlueprintMutation = useMutation(
    createBlueprintMutationOptions({ queryClient }),
  );
  const createTierMutation = useMutation(
    createTierMutationOptions({ queryClient }),
  );
  const [isCreating, setIsCreating] = useState(false);

  async function submit(
    blueprintInput: CreateBlueprintInput,
    pendingTiers: readonly PendingTierDraft[],
  ): Promise<void> {
    setIsCreating(true);
    try {
      const blueprint =
        await createBlueprintMutation.mutateAsync(blueprintInput);
      const failures: number[] = [];
      for (const draft of pendingTiers) {
        try {
          await createTierMutation.mutateAsync({
            blueprintId: blueprint.id,
            constructionCostsJson: draft.constructionCostsJson,
            effectsJson: draft.effectsJson,
            tierNumber: draft.tierNumber,
            upkeepCostsJson: draft.upkeepCostsJson,
            workerTurnsRequired: draft.workerTurnsRequired,
          });
        } catch {
          failures.push(draft.tierNumber);
        }
      }
      if (failures.length > 0) {
        handleCrudError(
          new Error(
            `Blueprint created, but tier${failures.length > 1 ? "s" : ""} ${failures.join(", ")} failed — use "Manage tiers →" to add them.`,
          ),
          "Failed to create all blueprint tiers.",
        );
      } else {
        notifyMutationSuccess(
          pendingTiers.length > 0
            ? "Blueprint and tiers created."
            : "Blueprint created.",
        );
      }
    } catch (error) {
      handleCrudError(error, "Failed to create blueprint.");
    } finally {
      setIsCreating(false);
    }
  }

  return {
    submit,
    isCreating,
  };
}
