import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resourceCategoriesByWorldQueryOptions } from "@/features/resourceCategories";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
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

import {
  ResourceFormFields,
  type ResourceFieldErrors,
} from "./ResourceFormFields";

import type { Resource, ResourceChangeMode } from "../../types/resourceTypes";

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
  const [changeMode, setChangeMode] = useState<ResourceChangeMode>(
    resource.changeMode,
  );
  const [changeAmount, setChangeAmount] = useState(
    String(resource.changeAmount),
  );
  const [icon, setIcon] = useState<string | null>(resource.icon);
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(
    resource.iconColor as CategoricalSlot | null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    resource.categoryId,
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ResourceFieldErrors>();

  const categoriesQuery = useQuery(
    resourceCategoriesByWorldQueryOptions(worldId),
  );

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
      categoryId,
      changeAmount: changeAmount !== "" ? changeAmount : undefined,
      changeMode,
      icon,
      iconColor,
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
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          aria-label="Edit resource"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit resource</DialogTitle>
          </DialogHeader>
          <ResourceFormFields
            baseStockpileCap={baseStockpileCap}
            categories={categoriesQuery.data}
            categoryId={categoryId}
            changeAmount={changeAmount}
            changeMode={changeMode}
            disabled={isPending}
            fieldErrors={fieldErrors}
            icon={icon}
            iconColor={iconColor}
            idPrefix="edit-resource"
            name={name}
            slug={slug}
            onBaseStockpileCapChange={setBaseStockpileCap}
            onCategoryIdChange={setCategoryId}
            onChangeAmountChange={setChangeAmount}
            onChangeModeChange={setChangeMode}
            onIconChange={setIcon}
            onIconColorChange={setIconColor}
            onNameChange={handleNameChange}
          />
          <DialogFooter className="sm:justify-between">
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
