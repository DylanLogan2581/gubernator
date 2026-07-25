import { useMemo, useState, type JSX } from "react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorldGeneratedNamingConfig } from "@/lib/worldNamingConfigSchemas";

import {
  loadNamesetLibraryDefinition,
  namesetLibraryIndex,
  type NamesetLibraryIndexEntry,
} from "../../library/namesetLibrary";

import { NameGenerationPreview } from "./NameGenerationPreview";

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

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return namesetLibraryIndex;
    return namesetLibraryIndex.filter((entry) => {
      // Match the display name, the category, and the id with its dashes
      // treated as spaces so franchise prefixes buried in the id (e.g.
      // "star-trek-klingon-names") are discoverable by queries like
      // "star trek" even though the display name is just "Klingon".
      const haystack = `${entry.displayName} ${entry.category} ${entry.id.replace(/-/g, " ")}`;
      return haystack.toLowerCase().includes(query);
    });
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
    onSelect(entry.id, entry.displayName, config);
  }

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

      {previewConfig === null ? (
        <div className="grid content-start gap-2">
          <p className="text-sm text-muted-foreground">
            Select a generator to preview sample names.
          </p>
        </div>
      ) : (
        <NameGenerationPreview config={previewConfig} />
      )}
    </div>
  );
}
