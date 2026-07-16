import { type JSX } from "react";

import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { PercentInput } from "@/components/shared/PercentInput";
import { SlugHint } from "@/components/shared/SlugHint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { managedPopulationInputLimits } from "@/lib/inputLimits";

import type { ManagedPopulationTypeFieldErrors } from "../hooks/UsePopulationTypeForm";

type PopulationTypeScalarFieldsProps = {
  readonly fieldErrors: ManagedPopulationTypeFieldErrors;
  readonly growthRate: number;
  readonly icon: string | null;
  readonly iconColor: CategoricalSlot | null;
  readonly isPending: boolean;
  readonly name: string;
  readonly slug: string;
  readonly onGrowthRateChange: (value: number) => void;
  readonly onIconChange: (value: string | null) => void;
  readonly onIconColorChange: (value: CategoricalSlot | null) => void;
  readonly onNameChange: (value: string) => void;
};

export function PopulationTypeScalarFields({
  fieldErrors,
  growthRate,
  icon,
  iconColor,
  isPending,
  name,
  slug,
  onGrowthRateChange,
  onIconChange,
  onIconColorChange,
  onNameChange,
}: PopulationTypeScalarFieldsProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Label className="grid gap-1 text-sm" htmlFor="population-name">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          aria-label="Name"
          disabled={isPending}
          id="population-name"
          maxLength={managedPopulationInputLimits.populationTypeNameMax}
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
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Icon</span>
        <IconPicker disabled={isPending} value={icon} onChange={onIconChange} />
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Icon color</span>
        <PaletteSlotPicker
          disabled={isPending}
          value={iconColor}
          onChange={onIconColorChange}
        />
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Growth rate</span>
        <PercentInput
          aria-invalid={fieldErrors.growthRate !== undefined}
          aria-label="Growth rate"
          disabled={isPending}
          value={growthRate}
          onChange={onGrowthRateChange}
        />
        {fieldErrors.growthRate !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.growthRate}</p>
        ) : null}
      </div>
    </div>
  );
}
