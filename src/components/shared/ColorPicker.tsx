import { Input } from "@/components/ui/input";

import type { JSX } from "react";

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

type ColorPickerProps = {
  readonly disabled?: boolean;
  readonly onChange: (hex: string) => void;
  readonly value: string;
};

/**
 * Paired native color swatch + hex text input, both bound to the same
 * `value`/`onChange`. Free-typed hex values are only forwarded to `onChange`
 * once they match `#rrggbb` (case-insensitive), normalized to lowercase —
 * the swatch input always produces a valid value, so it forwards directly.
 */
export function ColorPicker({
  disabled = false,
  onChange,
  value,
}: ColorPickerProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="Color swatch"
        className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        type="color"
        value={HEX_COLOR_REGEX.test(value) ? value : "#6b7280"}
        onChange={(event) => {
          onChange(event.currentTarget.value.toLowerCase());
        }}
      />
      <Input
        aria-label="Color hex value"
        className="max-w-32"
        disabled={disabled}
        maxLength={7}
        placeholder="#6b7280"
        value={value}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          onChange(HEX_COLOR_REGEX.test(raw) ? raw.toLowerCase() : raw);
        }}
      />
    </div>
  );
}
