import { type JSX } from "react";

import { Label } from "@/components/ui/label";
import {
  NAME_CONVENTIONS,
  type NameConvention,
} from "@/lib/worldNamingConfigSchemas";

export function ConventionPicker({
  convention,
  onChange,
}: {
  readonly convention: NameConvention;
  readonly onChange: (convention: NameConvention) => void;
}): JSX.Element {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-base font-semibold">Surname rule</legend>
      <p className="text-xs text-muted-foreground">
        Controls how a surname is chosen for generated NPCs and newborn
        children. Given names always come from the pools/patterns above.
      </p>
      <div className="grid gap-1.5">
        {NAME_CONVENTIONS.map((option) => (
          <Label
            key={option}
            className="flex items-center gap-2 text-sm"
            htmlFor={`convention-${option}`}
          >
            <input
              type="radio"
              id={`convention-${option}`}
              name="nameset-convention"
              className="h-4 w-4 accent-primary"
              value={option}
              checked={convention === option}
              onChange={() => onChange(option)}
            />
            <ConventionLabel convention={option} />
          </Label>
        ))}
      </div>
    </fieldset>
  );
}

function ConventionLabel({
  convention,
}: {
  readonly convention: NameConvention;
}): JSX.Element {
  switch (convention) {
    case "pool":
      return (
        <span>
          Surname pool — each NPC gets a random surname from the surname pool
        </span>
      );
    case "patronymic":
      return (
        <span>
          Patronymic — surname is the father&apos;s given name (falls back to
          the other parent if no male parent)
        </span>
      );
    case "matronymic":
      return (
        <span>
          Matronymic — surname is the mother&apos;s given name (falls back to
          the other parent if no female parent)
        </span>
      );
    case "family-name":
      return (
        <span>
          Family name — child inherits a parent&apos;s surname (50/50 which
          parent; falls back to the other if one has none)
        </span>
      );
    case "none":
      return <span>No automatic surname — surnames are entered manually</span>;
  }
}
