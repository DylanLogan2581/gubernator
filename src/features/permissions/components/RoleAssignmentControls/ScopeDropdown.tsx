import { type JSX } from "react";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

// Read-only preview of the resolved scope. The scope is always derived from
// the citizen's current settlement, so the select is intentionally disabled —
// it confirms where the role will be applied, not allows the user to pick a
// different target. If multi-target assignment is ever supported (e.g. assigning
// a nation_manager to any nation regardless of settlement), this will become
// an interactive picker.
export function ScopeDropdown({
  isLoading,
  label,
  optionLabel,
  optionValue,
}: {
  readonly isLoading: boolean;
  readonly label: string;
  readonly optionLabel: string;
  readonly optionValue: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <Label htmlFor="scope-dropdown">{label}</Label>
      <NativeSelect
        id="scope-dropdown"
        aria-label={label}
        className="bg-transparent px-2"
        disabled
        value={optionValue}
      >
        {isLoading ? (
          <option value="">Loading…</option>
        ) : (
          <option value={optionValue}>
            {optionLabel === "" ? "Not available" : optionLabel}
          </option>
        )}
      </NativeSelect>
    </div>
  );
}
