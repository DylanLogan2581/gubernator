import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { resourceCategoriesByWorldQueryOptions } from "@/features/resourceCategories";
import { resourceInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createResourceInputSchema,
  type CreateResourceInput,
} from "../../schemas/resourceSchemas";
import {
  buildChangePreviewText,
  isPercentChangeBelowMinimum,
} from "../../utils/changePreviewText";

import type { ResourceChangeMode } from "../../types/resourceTypes";

type CreateResourceFieldErrors = {
  readonly baseStockpileCap?: string;
  readonly changeAmount?: string;
  readonly name?: string;
  readonly slug?: string;
};

type CreateResourceFormProps = {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateResourceInput) => void;
  readonly worldId: string;
};

export function CreateResourceForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: CreateResourceFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [baseStockpileCap, setBaseStockpileCap] = useState("");
  const [changeMode, setChangeMode] = useState<ResourceChangeMode>("percent");
  const [changeAmount, setChangeAmount] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof CreateResourceFieldErrors>();

  const categoriesQuery = useQuery(
    resourceCategoriesByWorldQueryOptions(worldId),
  );

  const derivedSlug = toSlug(name, {
    maxLength: resourceInputLimits.resourceSlugMax,
  });

  const parsedChangeAmount = changeAmount !== "" ? parseFloat(changeAmount) : 0;
  const changePreview = buildChangePreviewText(changeMode, parsedChangeAmount);
  const isChangeAmountBelowMinimum = isPercentChangeBelowMinimum(
    changeMode,
    parsedChangeAmount,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      categoryId,
      changeAmount: changeAmount !== "" ? changeAmount : undefined,
      changeMode,
      icon,
      name,
      slug: derivedSlug,
      worldId,
    };

    const result = createResourceInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create resource</DialogTitle>
            <DialogDescription>
              Define a resource and its base stockpile settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label
              className="grid gap-1 text-sm"
              htmlFor="create-resource-name"
            >
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="create-resource-name"
                maxLength={resourceInputLimits.resourceNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
              <SlugHint slug={derivedSlug} error={fieldErrors.slug} />
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="create-resource-cap">
              <span className="text-muted-foreground">Base stockpile cap</span>
              <Input
                aria-invalid={fieldErrors.baseStockpileCap !== undefined}
                disabled={isPending}
                id="create-resource-cap"
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
                  id="create-resource-change-amount"
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
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
