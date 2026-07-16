import { RotateCcw } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createSeededRng } from "@/lib/seededRng";
import type { WorldGeneratedNamingConfig } from "@/lib/worldNamingConfigSchemas";
import { generateName } from "@/shared/naming";

import {
  loadNamesetLibraryDefinition,
  namesetLibraryIndex,
  type NamesetLibraryIndexEntry,
} from "../../library/namesetLibrary";

const PREVIEW_COUNT = 10;

function groupByCategory(
  entries: readonly NamesetLibraryIndexEntry[],
): ReadonlyMap<string, readonly NamesetLibraryIndexEntry[]> {
  const groups = new Map<string, NamesetLibraryIndexEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.category);
    if (group === undefined) {
      groups.set(entry.category, [entry]);
    } else {
      group.push(entry);
    }
  }
  return groups;
}

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

export function NamesetLibraryPicker({
  selectedId,
  onSelect,
}: {
  readonly selectedId: string | null;
  readonly onSelect: (
    id: string,
    displayName: string,
    config: WorldGeneratedNamingConfig,
  ) => void;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [previewConfig, setPreviewConfig] =
    useState<WorldGeneratedNamingConfig | null>(null);
  const [rerollSeed, setRerollSeed] = useState(0);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return namesetLibraryIndex;
    return namesetLibraryIndex.filter((entry) =>
      entry.displayName.toLowerCase().includes(query),
    );
  }, [search]);

  const groupedEntries = useMemo(
    () => groupByCategory(filteredEntries),
    [filteredEntries],
  );

  async function handleSelectEntry(
    entry: NamesetLibraryIndexEntry,
  ): Promise<void> {
    setLoadingId(entry.id);
    setLoadError(undefined);
    const config = await loadNamesetLibraryDefinition(entry.id);
    setLoadingId(null);
    if (config === null) {
      setLoadError(`Could not load "${entry.displayName}". Try another.`);
      setPreviewConfig(null);
      return;
    }
    setPreviewConfig(config);
    setRerollSeed(0);
    onSelect(entry.id, entry.displayName, config);
  }

  const previewNames =
    previewConfig !== null
      ? {
          female: generatePreviewNames(previewConfig, rerollSeed, "female"),
          male: generatePreviewNames(previewConfig, rerollSeed, "male"),
        }
      : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2">
        <Input
          aria-label="Search name generators"
          placeholder="Search generators…"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
        <ScrollArea className="h-64 rounded-md border">
          <div className="grid gap-1 p-2">
            {filteredEntries.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                No generators match your search.
              </p>
            ) : (
              [...groupedEntries.entries()].map(([category, entries]) => (
                <div key={category} className="grid gap-1">
                  <p className="px-2 pt-2 text-xs font-semibold text-muted-foreground">
                    {category}
                  </p>
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selectedId === entry.id}
                      disabled={loadingId === entry.id}
                      className={
                        "rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground " +
                        (selectedId === entry.id
                          ? "bg-accent text-accent-foreground"
                          : "")
                      }
                      onClick={() => {
                        void handleSelectEntry(entry);
                      }}
                    >
                      {entry.displayName}
                      {loadingId === entry.id ? " (loading…)" : ""}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {loadError !== undefined ? (
          <p role="alert" className="text-xs text-destructive">
            {loadError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 content-start rounded-md border p-3">
        {previewNames === null ? (
          <p className="text-sm text-muted-foreground">
            Select a generator to preview sample names.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Preview</p>
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
                <p className="text-xs font-medium text-muted-foreground">
                  Female
                </p>
                <ul className="text-sm">
                  {previewNames.female.map((sampleName, index) => (
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length sample list, replaced wholesale on re-roll
                    <li key={index}>{sampleName}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Male
                </p>
                <ul className="text-sm">
                  {previewNames.male.map((sampleName, index) => (
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length sample list, replaced wholesale on re-roll
                    <li key={index}>{sampleName}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
