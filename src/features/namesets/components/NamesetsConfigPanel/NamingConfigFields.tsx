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
  const showEmptyPoolWarning = config.convention !== "manual" && hasEmptyPool;

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
            One or more name pools are empty. Random NPC names may be blank
            unless <strong>manual only</strong> is selected.
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
        <legend className="text-base font-semibold">Naming convention</legend>
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
    case "random":
      return <span>Random — pick any name from the pool</span>;
    case "patronymic":
      return <span>Patronymic — family name derived from father</span>;
    case "matronymic":
      return <span>Matronymic — family name derived from mother</span>;
    case "inherited family name":
      return <span>Inherited family name — surname passed from parents</span>;
    case "manual":
      return (
        <span>
          Manual only — names must be set manually; no automatic generation
        </span>
      );
  }
}
