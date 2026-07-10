import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ColorPicker } from "@/components/shared/ColorPicker";
import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resourceCategoryInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  deleteResourceCategoryMutationOptions,
  updateResourceCategoryMutationOptions,
} from "../../mutations/resourceCategoriesMutations";
import {
  updateResourceCategoryInputSchema,
  type UpdateResourceCategoryInput,
} from "../../schemas/resourceCategorySchemas";

import type { ResourceCategory } from "../../types/resourceCategoryTypes";

type ResourceCategoryFieldErrors = {
  readonly color?: string;
  readonly name?: string;
};

type EditResourceCategoryFormProps = {
  readonly category: ResourceCategory;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function EditResourceCategoryForm({
  category,
  onClose,
  queryClient,
  worldId,
}: EditResourceCategoryFormProps): JSX.Element {
  const updateMutation = useMutation(
    updateResourceCategoryMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteResourceCategoryMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState<string | null>(category.icon);
  const [color, setColor] = useState(category.color);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ResourceCategoryFieldErrors>();

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateResourceCategoryInput = {
      categoryId: category.id,
      color,
      icon,
      name,
      worldId,
    };

    const result = updateResourceCategoryInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Resource category saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save resource category.");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ categoryId: category.id, worldId });
      notifyMutationSuccess("Resource category deleted.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to delete resource category.");
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
          aria-label="Edit resource category"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit resource category</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label
              className="grid gap-1 text-sm"
              htmlFor="edit-resource-category-name"
            >
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="edit-resource-category-name"
                maxLength={resourceCategoryInputLimits.nameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Icon</span>
              <IconPicker
                disabled={isPending}
                value={icon}
                onChange={setIcon}
              />
            </Label>
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Color</span>
              <ColorPicker
                disabled={isPending}
                value={color}
                onChange={setColor}
              />
              {fieldErrors.color !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.color}</p>
              ) : null}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Deleting this category leaves any resources using it uncategorized.
          </p>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                void handleDelete();
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete
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
