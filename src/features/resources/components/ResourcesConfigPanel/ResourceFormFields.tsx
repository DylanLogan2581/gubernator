import { type JSX } from "react";

import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { SlugHint } from "@/components/shared/SlugHint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ResourceCategory } from "@/features/resourceCategories";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { resourceInputLimits } from "@/lib/inputLimits";

import {
  buildChangePreviewText,
  isPercentChangeBelowMinimum,
} from "../../utils/changePreviewText";

import type { ResourceChangeMode } from "../../types/resourceTypes";

export type ResourceFieldErrors = {
  readonly baseStockpileCap?: string;
  readonly changeAmount?: string;
  readonly name?: string;
  readonly slug?: string;
};

export function ResourceFormFields({
  baseStockpileCap,
  categories,
  categoryId,
  changeAmount,
  changeMode,
  disabled,
  fieldErrors,
  icon,
  iconColor,
  idPrefix,
  name,
  onBaseStockpileCapChange,
  onCategoryIdChange,
  onChangeAmountChange,
  onChangeModeChange,
  onIconChange,
  onIconColorChange,
  onNameChange,
  slug,
}: {
  readonly baseStockpileCap: string;
  readonly categories: readonly ResourceCategory[] | undefined;
  readonly categoryId: string | null;
  readonly changeAmount: string;
  readonly changeMode: ResourceChangeMode;
  readonly disabled: boolean;
  readonly fieldErrors: ResourceFieldErrors;
  readonly icon: string | null;
  readonly iconColor: CategoricalSlot | null;
  readonly idPrefix: string;
  readonly name: string;
  readonly onBaseStockpileCapChange: (value: string) => void;
  readonly onCategoryIdChange: (value: string | null) => void;
  readonly onChangeAmountChange: (value: string) => void;
  readonly onChangeModeChange: (value: ResourceChangeMode) => void;
  readonly onIconChange: (value: string | null) => void;
  readonly onIconColorChange: (value: CategoricalSlot | null) => void;
  readonly onNameChange: (value: string) => void;
  readonly slug: string;
}): JSX.Element {
  const parsedChangeAmount = changeAmount !== "" ? parseFloat(changeAmount) : 0;
  const changePreview = buildChangePreviewText(changeMode, parsedChangeAmount);
  const isChangeAmountBelowMinimum = isPercentChangeBelowMinimum(
    changeMode,
    parsedChangeAmount,
  );

  return (
    <div className="grid gap-3">
      <Label className="grid gap-1 text-sm" htmlFor={`${idPrefix}-name`}>
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          aria-label="Name"
          disabled={disabled}
          id={`${idPrefix}-name`}
          maxLength={resourceInputLimits.resourceNameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.name !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
        <SlugHint slug={slug} error={fieldErrors.slug} />
      </Label>
      <Label className="grid gap-1 text-sm" htmlFor={`${idPrefix}-cap`}>
        <span className="text-muted-foreground">Base stockpile cap</span>
        <Input
          aria-invalid={fieldErrors.baseStockpileCap !== undefined}
          disabled={disabled}
          id={`${idPrefix}-cap`}
          inputMode="decimal"
          placeholder="0"
          value={baseStockpileCap}
          onChange={(e) => {
            onBaseStockpileCapChange(e.currentTarget.value);
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
            disabled={disabled}
            value={changeMode}
            onChange={(e) => {
              onChangeModeChange(e.currentTarget.value as ResourceChangeMode);
            }}
          >
            <option value="percent">Percent</option>
            <option value="flat">Flat amount</option>
          </NativeSelect>
          <Input
            aria-invalid={fieldErrors.changeAmount !== undefined}
            aria-label="Change amount"
            disabled={disabled}
            id={`${idPrefix}-change-amount`}
            inputMode="decimal"
            placeholder="0"
            value={changeAmount}
            onChange={(e) => {
              onChangeAmountChange(e.currentTarget.value);
            }}
          />
        </div>
        {fieldErrors.changeAmount !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.changeAmount}</p>
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
        <IconPicker disabled={disabled} value={icon} onChange={onIconChange} />
      </Label>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Icon color</span>
        <PaletteSlotPicker
          disabled={disabled}
          value={iconColor}
          onChange={onIconColorChange}
        />
      </Label>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Category</span>
        <NativeSelect
          aria-label="Category"
          disabled={disabled}
          value={categoryId ?? ""}
          onChange={(e) => {
            const next = e.currentTarget.value;
            onCategoryIdChange(next === "" ? null : next);
          }}
        >
          <option value="">Uncategorized</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
      </Label>
    </div>
  );
}
