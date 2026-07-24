import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { educationLevelInputLimits } from "@/lib/inputLimits";

import type { JSX } from "react";

export type EducationLevelFieldErrors = {
  readonly description?: string;
  readonly name?: string;
  readonly naturalBornPercent?: string;
};

export function EducationLevelFormFields({
  description,
  disabled,
  fieldErrors,
  icon,
  iconColor,
  idPrefix,
  name,
  naturalBornPercent,
  onDescriptionChange,
  onIconChange,
  onIconColorChange,
  onNameChange,
  onNaturalBornPercentChange,
  projectedTotal,
}: {
  readonly description: string;
  readonly disabled: boolean;
  readonly fieldErrors: EducationLevelFieldErrors;
  readonly icon: string | null;
  readonly iconColor: CategoricalSlot | null;
  readonly idPrefix: string;
  readonly name: string;
  readonly naturalBornPercent: string;
  readonly onDescriptionChange: (value: string) => void;
  readonly onIconChange: (value: string | null) => void;
  readonly onIconColorChange: (value: CategoricalSlot | null) => void;
  readonly onNameChange: (value: string) => void;
  readonly onNaturalBornPercentChange: (value: string) => void;
  readonly projectedTotal: number;
}): JSX.Element {
  return (
    <div className="grid gap-3">
      <Label className="grid gap-1 text-sm" htmlFor={`${idPrefix}-name`}>
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          aria-label="Name"
          disabled={disabled}
          id={`${idPrefix}-name`}
          maxLength={educationLevelInputLimits.nameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.name !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
      </Label>
      <Label className="grid gap-1 text-sm" htmlFor={`${idPrefix}-description`}>
        <span className="text-muted-foreground">Description</span>
        <Textarea
          aria-invalid={fieldErrors.description !== undefined}
          disabled={disabled}
          id={`${idPrefix}-description`}
          maxLength={educationLevelInputLimits.descriptionMax}
          value={description}
          onChange={(e) => {
            onDescriptionChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.description !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        ) : null}
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
      <Label
        className="grid gap-1 text-sm"
        htmlFor={`${idPrefix}-natural-born-percent`}
      >
        <span className="text-muted-foreground">Natural born %</span>
        <p className="text-xs text-muted-foreground">
          Share of newborns that start at this education level; all levels
          together may total at most 100%.
        </p>
        <Input
          aria-invalid={fieldErrors.naturalBornPercent !== undefined}
          aria-label="Natural born %"
          disabled={disabled}
          id={`${idPrefix}-natural-born-percent`}
          max={100}
          min={0}
          type="number"
          value={naturalBornPercent}
          onChange={(e) => {
            onNaturalBornPercentChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.naturalBornPercent !== undefined ? (
          <p className="text-xs text-destructive">
            {fieldErrors.naturalBornPercent}
          </p>
        ) : null}
        <p
          className={
            projectedTotal > 100
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          World total would be {projectedTotal} / 100
          {projectedTotal > 100 ? " — over the limit" : ""}
        </p>
      </Label>
    </div>
  );
}
