import { AlertTriangle } from "lucide-react";
import { type JSX } from "react";

import { PoolEditor } from "@/components/shared/PoolEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WorldListNamingConfig } from "@/lib/worldNamingConfigSchemas";

import { ConventionPicker } from "./ConventionPicker";

export function NamingConfigFields({
  config,
  onChange,
}: {
  readonly config: WorldListNamingConfig;
  readonly onChange: (config: WorldListNamingConfig) => void;
}): JSX.Element {
  const hasEmptyPool =
    config.male_given_names.length === 0 ||
    config.female_given_names.length === 0;
  const showEmptyPoolWarning = config.convention !== "none" && hasEmptyPool;

  return (
    <div className="grid gap-4">
      {showEmptyPoolWarning ? (
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription>
            One or more name pools are empty. Generated NPC names may be blank.
          </AlertDescription>
        </Alert>
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

      <ConventionPicker
        convention={config.convention}
        onChange={(convention) => onChange({ ...config, convention })}
      />
    </div>
  );
}
