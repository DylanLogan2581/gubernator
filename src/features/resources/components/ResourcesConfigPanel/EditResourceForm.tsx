import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { SlugHint } from "@/components/shared/SlugHint";
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
import { NativeSelect } from "@/components/ui/native-select";
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
import {
  buildChangePreviewText,
  isPercentChangeBelowMinimum,
} from "../../utils/changePreviewText";
import { buildCleanupDescription } from "../../utils/cleanupDescription";

import type { Resource, ResourceChangeMode } from "../../types/resourceTypes";

type ResourceFieldErrors = {
  readonly baseStockpileCap?: string;
  readonly changeAmount?: string;
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

  const parsedChangeAmount = changeAmount !== "" ? parseFloat(changeAmount) : 0;
  const changePreview = buildChangePreviewText(changeMode, parsedChangeAmount);
  const isChangeAmountBelowMinimum = isPercentChangeBelowMinimum(
    changeMode,
    parsedChangeAmount,
  );

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
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Change per turn</span>
              <div className="flex gap-2">
                <NativeSelect
                  aria-label="Change mode"
                  disabled={isPending}
                  value={changeMode}
                  onChange={(e) => {
                    setChangeMode(e.currentTarget.value as ResourceChangeMode);
                  }}
                >
                  <option value="percent">Percent</option>
                  <option value="flat">Flat amount</option>
                </NativeSelect>
                <Input
                  aria-invalid={fieldErrors.changeAmount !== undefined}
                  aria-label="Change amount"
                  disabled={isPending}
                  id="edit-resource-change-amount"
                  inputMode="decimal"
                  placeholder="0"
                  value={changeAmount}
                  onChange={(e) => {
                    setChangeAmount(e.currentTarget.value);
                  }}
                />
              </div>
              {fieldErrors.changeAmount !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.changeAmount}
                </p>
              ) : isChangeAmountBelowMinimum ? (
                <p className="text-xs text-destructive">
                  Percent decay cannot exceed 100% per turn.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{changePreview}</p>
              )}
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
              <span className="text-muted-foreground">Icon color</span>
              <PaletteSlotPicker
                disabled={isPending}
                value={iconColor}
                onChange={setIconColor}
              />
            </Label>
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Category</span>
              <NativeSelect
                aria-label="Category"
                disabled={isPending}
                value={categoryId ?? ""}
                onChange={(e) => {
                  const next = e.currentTarget.value;
                  setCategoryId(next === "" ? null : next);
                }}
              >
                <option value="">Uncategorized</option>
                {categoriesQuery.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          </div>
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
