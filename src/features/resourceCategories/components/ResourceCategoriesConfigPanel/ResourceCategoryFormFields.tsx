
import { ColorPicker } from "@/components/shared/ColorPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resourceCategoryInputLimits } from "@/lib/inputLimits";

import type { JSX } from "react";

export type ResourceCategoryFieldErrors = {
  readonly color?: string;
  readonly name?: string;
};

export function ResourceCategoryFormFields({
  color,
  disabled,
  fieldErrors,
  idPrefix,
  name,
  onColorChange,
  onNameChange,
}: {
  readonly color: string;
  readonly disabled: boolean;
  readonly fieldErrors: ResourceCategoryFieldErrors;
  readonly idPrefix: string;
  readonly name: string;
  readonly onColorChange: (value: string) => void;
  readonly onNameChange: (value: string) => void;
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
          maxLength={resourceCategoryInputLimits.nameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.name !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
      </Label>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Color</span>
        <ColorPicker
          disabled={disabled}
          value={color}
          onChange={onColorChange}
        />
        {fieldErrors.color !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.color}</p>
        ) : null}
      </Label>
    </div>
  );
}
