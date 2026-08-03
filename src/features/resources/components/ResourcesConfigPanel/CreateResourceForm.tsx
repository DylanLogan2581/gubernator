import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resourceCategoriesByWorldQueryOptions } from "@/features/resourceCategories";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { resourceInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createResourceInputSchema,
  type CreateResourceInput,
} from "../../schemas/resourceSchemas";

import {
  ResourceFormFields,
  type ResourceFieldErrors,
} from "./ResourceFormFields";

import type { ResourceChangeMode } from "../../types/resourceTypes";

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
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ResourceFieldErrors>();

  const categoriesQuery = useQuery(
    resourceCategoriesByWorldQueryOptions(worldId),
  );

  const derivedSlug = toSlug(name, {
    maxLength: resourceInputLimits.resourceSlugMax,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      categoryId,
      changeAmount: changeAmount !== "" ? changeAmount : undefined,
      changeMode,
      icon,
      iconColor,
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
            idPrefix="create-resource"
            name={name}
            slug={derivedSlug}
            onBaseStockpileCapChange={setBaseStockpileCap}
            onCategoryIdChange={setCategoryId}
            onChangeAmountChange={setChangeAmount}
            onChangeModeChange={setChangeMode}
            onIconChange={setIcon}
            onIconColorChange={setIconColor}
            onNameChange={setName}
          />
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
