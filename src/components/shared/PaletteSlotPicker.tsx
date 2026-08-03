import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CATEGORICAL_SLOT_COUNT,
  categoricalChipClassName,
  type CategoricalSlot,
} from "@/lib/categoricalPalette";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

const SLOTS: readonly CategoricalSlot[] = Array.from(
  { length: CATEGORICAL_SLOT_COUNT },
  (_, index) => (index + 1) as CategoricalSlot,
);

type PaletteSlotPickerProps = {
  readonly disabled?: boolean;
  readonly onChange: (value: CategoricalSlot | null) => void;
  readonly value: CategoricalSlot | null;
};

/**
 * Fixed 8-swatch picker over the categorical palette (`categoricalPalette.ts`)
 * plus an "Auto" option for `null`, which keeps the UUID-hash fallback
 * (`hashToCategoricalSlot`/`resolveIconTone`) instead of a pinned color.
 */
export function PaletteSlotPicker({
  disabled = false,
  onChange,
  value,
}: PaletteSlotPickerProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SLOTS.map((slot) => {
        const isSelected = value === slot;
        return (
          <Button
            key={slot}
            aria-label={`Color ${String(slot)}`}
            aria-pressed={isSelected}
            className={cn(
              "relative size-8 rounded-md p-0",
              categoricalChipClassName(slot),
              isSelected &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
            disabled={disabled}
            type="button"
            variant="ghost"
            onClick={() => {
              onChange(slot);
            }}
          >
            {isSelected && <Check className="size-4" />}
          </Button>
        );
      })}
      <Button
        aria-label="Auto (hash-based color)"
        aria-pressed={value === null}
        className={cn(
          "h-8 rounded-md px-2 text-xs font-normal",
          value === null && "bg-accent text-accent-foreground",
        )}
        disabled={disabled}
        type="button"
        variant="outline"
        onClick={() => {
          onChange(null);
        }}
      >
        Auto
      </Button>
    </div>
  );
}
