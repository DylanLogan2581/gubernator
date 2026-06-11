import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resourceInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  softDeleteResourceMutationOptions,
  updateResourceMutationOptions,
} from "../../mutations/resourcesMutations";
import {
  updateResourceInputSchema,
  type UpdateResourceInput,
} from "../../schemas/resourceSchemas";
import { buildCleanupDescription } from "../../utils/cleanupDescription";

import type { Resource } from "../../types/resourceTypes";

type ResourceFieldErrors = {
  readonly baseStockpileCap?: string;
  readonly decayRate?: string;
  readonly name?: string;
  readonly slug?: string;
};

type EditResourceFormProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly resource: Resource;
  readonly worldId: string;
};

export function EditResourceForm({
  onClose,
  queryClient,
  resource,
  worldId,
}: EditResourceFormProps): JSX.Element {
  const updateMutation = useMutation(
    updateResourceMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteResourceMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(resource.name);
  const [slug, setSlug] = useState(resource.slug);
  const [baseStockpileCap, setBaseStockpileCap] = useState(
    String(resource.baseStockpileCap),
  );
  const [decayRate, setDecayRate] = useState(String(resource.decayRate));
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ResourceFieldErrors>();

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(toSlug(value, { maxLength: resourceInputLimits.resourceSlugMax }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      decayRate: decayRate !== "" ? decayRate : undefined,
      name,
      resourceId: resource.id,
      slug,
      worldId,
    };

    const result = updateResourceInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Resource saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save resource.");
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      const result = await softDeleteMutation.mutateAsync({
        resourceId: resource.id,
        worldId,
      });
      const description = buildCleanupDescription(result.cleanupSummary);
      notifyMutationSuccess(
        "Resource moved to trash.",
        description !== undefined ? { description } : undefined,
      );
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to move resource to trash.");
    }
  }

  return (
    <form
      aria-label="Edit resource"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit resource</h3>
      <div className="grid gap-3">
        <Label className="grid gap-1 text-sm" htmlFor="edit-resource-name">
          <span className="text-muted-foreground">Name</span>
          <Input
            aria-invalid={fieldErrors.name !== undefined}
            aria-label="Name"
            disabled={isPending}
            id="edit-resource-name"
            maxLength={resourceInputLimits.resourceNameMax}
            value={name}
            onChange={(e) => {
              handleNameChange(e.currentTarget.value);
            }}
          />
          {fieldErrors.name !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
          <SlugHint slug={slug} error={fieldErrors.slug} />
        </Label>
        <Label className="grid gap-1 text-sm" htmlFor="edit-resource-cap">
          <span className="text-muted-foreground">Base stockpile cap</span>
          <Input
            aria-invalid={fieldErrors.baseStockpileCap !== undefined}
            disabled={isPending}
            id="edit-resource-cap"
            inputMode="decimal"
            placeholder="0"
            value={baseStockpileCap}
            onChange={(e) => {
              setBaseStockpileCap(e.currentTarget.value);
            }}
          />
          {fieldErrors.baseStockpileCap !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.baseStockpileCap}
            </p>
          ) : null}
        </Label>
        <Label className="grid gap-1 text-sm" htmlFor="edit-resource-decay">
          <span className="text-muted-foreground">Decay rate (%)</span>
          <Input
            aria-invalid={fieldErrors.decayRate !== undefined}
            disabled={isPending}
            id="edit-resource-decay"
            inputMode="decimal"
            placeholder="0"
            value={decayRate}
            onChange={(e) => {
              setDecayRate(e.currentTarget.value);
            }}
          />
          {fieldErrors.decayRate !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.decayRate}</p>
          ) : null}
        </Label>
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
          disabled={resource.isSystemResource || isPending}
          title={
            resource.isSystemResource
              ? "System resources cannot be deleted"
              : undefined
          }
          onClick={
            resource.isSystemResource
              ? undefined
              : () => {
                  void handleTrash();
                }
          }
        >
          <Trash2 aria-hidden="true" />
          Move to trash
        </Button>
      </div>
    </form>
  );
}
