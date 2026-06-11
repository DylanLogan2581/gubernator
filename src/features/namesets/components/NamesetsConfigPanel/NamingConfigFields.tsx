import { AlertTriangle } from "lucide-react";
import { type JSX } from "react";

import { PoolEditor } from "@/components/shared/PoolEditor";
import { Label } from "@/components/ui/label";
import {
  NAME_CONVENTIONS,
  type NameConvention,
  type WorldNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

export function NamingConfigFields({
  config,
  onChange,
}: {
  readonly config: WorldNamingConfig;
  readonly onChange: (config: WorldNamingConfig) => void;
}): JSX.Element {
  const hasEmptyPool =
    config.male_given_names.length === 0 ||
    config.female_given_names.length === 0;
  const showEmptyPoolWarning = config.convention !== "none" && hasEmptyPool;

  return (
    <div className="grid gap-4">
      {showEmptyPoolWarning ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning-foreground/20 bg-warning px-4 py-3 text-sm text-warning-foreground"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            One or more name pools are empty. Generated NPC names may be blank.
          </span>
        </div>
      ) : null}

      <PoolEditor
        label="Male given name pool"
        entries={config.male_given_names}
        onChange={(entries) =>
          onChange({ ...config, male_given_names: entries })
        }
      />

      <PoolEditor
        label="Female given name pool"
        entries={config.female_given_names}
        onChange={(entries) =>
          onChange({ ...config, female_given_names: entries })
        }
      />

      <PoolEditor
        label="Surname pool"
        entries={config.surnames}
        onChange={(entries) => onChange({ ...config, surnames: entries })}
      />

      <fieldset className="grid gap-2">
        <legend className="text-base font-semibold">Surname rule</legend>
        <p className="text-xs text-muted-foreground">
          Controls how a surname is chosen for generated NPCs and newborn
          children. Given names always come from the pools above.
        </p>
        <div className="grid gap-1.5">
          {NAME_CONVENTIONS.map((convention) => (
            <Label
              key={convention}
              className="flex items-center gap-2 text-sm"
              htmlFor={`convention-${convention}`}
            >
              <input
                type="radio"
                id={`convention-${convention}`}
                name={`convention-${convention}`}
                className="h-4 w-4 accent-primary"
                value={convention}
                checked={config.convention === convention}
                onChange={() => onChange({ ...config, convention })}
              />
              <ConventionLabel convention={convention} />
            </Label>
          ))}
        </div>
      </fieldset>
    </div>
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
