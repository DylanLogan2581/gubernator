import { RotateCcw } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { createSeededRng } from "@/lib/seededRng";
import type { WorldGeneratedNamingConfig } from "@/lib/worldNamingConfigSchemas";
import { generateName } from "@/shared/naming";

const PREVIEW_COUNT = 10;

function generatePreviewNames(
  config: WorldGeneratedNamingConfig,
  seed: number,
  sex: "female" | "male",
): readonly string[] {
  const rng = createSeededRng(`nameset-preview-${sex}-${String(seed)}`);
  return Array.from({ length: PREVIEW_COUNT }, () => {
    const result = generateName({ config, rng, sex });
    return result.surname !== null
      ? `${result.givenName} ${result.surname}`
      : result.givenName;
  });
}

export function NameGenerationPreview({
  config,
}: {
  readonly config: WorldGeneratedNamingConfig;
}): JSX.Element {
  const [rerollSeed, setRerollSeed] = useState(0);

  const female = generatePreviewNames(config, rerollSeed, "female");
  const male = generatePreviewNames(config, rerollSeed, "male");

  return (
    <div className="grid content-start gap-2">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <p className="eyebrow">Preview</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRerollSeed((seed) => seed + 1);
          }}
        >
          <RotateCcw aria-hidden="true" />
          Re-roll
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Female</p>
          <ul className="text-sm">
            {female.map((sampleName, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length sample list, replaced wholesale on re-roll
              <li key={index}>{sampleName}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Male</p>
          <ul className="text-sm">
            {male.map((sampleName, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length sample list, replaced wholesale on re-roll
              <li key={index}>{sampleName}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
