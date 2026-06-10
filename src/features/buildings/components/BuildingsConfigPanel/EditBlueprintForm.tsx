import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildingInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  softDeleteBlueprintMutationOptions,
  updateBlueprintMutationOptions,
} from "../../mutations/buildingsMutations";
import {
  updateBlueprintInputSchema,
  type UpdateBlueprintInput,
} from "../../schemas/buildingSchemas";

import type { BuildingBlueprint } from "../../types/buildingTypes";

type BlueprintFieldErrors = {
  readonly description?: string;
  readonly gracePeriodTurns?: string;
  readonly maxInstancesPerSettlement?: string;
  readonly name?: string;
  readonly slug?: string;
};

export function EditBlueprintForm({
  blueprint,
  onClose,
  queryClient,
  worldId,
}: {
  readonly blueprint: BuildingBlueprint;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateBlueprintMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteBlueprintMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(blueprint.name);
  const [slug, setSlug] = useState(blueprint.slug);
  const [description, setDescription] = useState(blueprint.description ?? "");

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(toSlug(value, { maxLength: buildingInputLimits.blueprintSlugMax }));
  }
  const [gracePeriodTurns, setGracePeriodTurns] = useState(
    String(blueprint.gracePeriodTurns),
  );
  const [maxInstances, setMaxInstances] = useState(
    blueprint.maxInstancesPerSettlement !== null
      ? String(blueprint.maxInstancesPerSettlement)
      : "",
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof BlueprintFieldErrors>();

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const updateInput: UpdateBlueprintInput = {
      blueprintId: blueprint.id,
      description: description.length > 0 ? description : undefined,
      gracePeriodTurns:
        gracePeriodTurns !== "" ? parseInt(gracePeriodTurns, 10) : undefined,
      maxInstancesPerSettlement:
        maxInstances !== "" ? parseInt(maxInstances, 10) : undefined,
      name,
      slug,
      worldId,
    };

    const result = updateBlueprintInputSchema.safeParse(updateInput);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Blueprint saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save blueprint.");
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({
        blueprintId: blueprint.id,
        worldId,
      });
      notifyMutationSuccess("Blueprint moved to trash.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to move blueprint to trash.");
    }
  }

  return (
    <form
      aria-label="Edit blueprint"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit blueprint</h3>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="edit-blueprint-name">Name</Label>
          <Input
            id="edit-blueprint-name"
            aria-invalid={fieldErrors.name !== undefined}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintNameMax}
            value={name}
            onChange={(e) => {
              handleNameChange(e.currentTarget.value);
            }}
          />
          {fieldErrors.name !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
          <SlugHint slug={slug} error={fieldErrors.slug} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="edit-blueprint-description">Description</Label>
          <Textarea
            id="edit-blueprint-description"
            aria-invalid={fieldErrors.description !== undefined}
            disabled={isPending}
            maxLength={buildingInputLimits.blueprintDescriptionMax}
            value={description}
            onChange={(e) => {
              setDescription(e.currentTarget.value);
            }}
          />
          {fieldErrors.description !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.description}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Label htmlFor="edit-grace-period-turns">Grace period (turns)</Label>
          <Input
            id="edit-grace-period-turns"
            aria-invalid={fieldErrors.gracePeriodTurns !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="0"
            value={gracePeriodTurns}
            onChange={(e) => {
              setGracePeriodTurns(e.currentTarget.value);
            }}
          />
          {fieldErrors.gracePeriodTurns !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.gracePeriodTurns}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Label htmlFor="edit-max-instances-settlement">
            Max instances per settlement
          </Label>
          <Input
            id="edit-max-instances-settlement"
            aria-invalid={fieldErrors.maxInstancesPerSettlement !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="Unlimited"
            value={maxInstances}
            onChange={(e) => {
              setMaxInstances(e.currentTarget.value);
            }}
          />
          {fieldErrors.maxInstancesPerSettlement !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.maxInstancesPerSettlement}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            void handleTrash();
          }}
        >
          <Trash2 aria-hidden="true" />
          Move to trash
        </Button>
      </div>
    </form>
  );
}
