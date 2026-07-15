import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";

import { IconChip } from "@/components/shared/IconChip";
import {
  formatIconLabel,
  resolveEntityIcon,
} from "@/components/shared/iconPicker/CuratedIcons";
import {
  categorizeGameIconName,
  getGameIconNames,
  GAME_ICON_CATEGORIES,
  isGameIconsDataLoaded,
  loadGameIconsData,
  toGameIconName,
} from "@/components/shared/iconPicker/GameIcons";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

const COLUMNS = 6;
const ALL_CATEGORIES = "All";

type GameIconsPanelProps = {
  readonly value: string | null;
  readonly onSelect: (name: string) => void;
};

/**
 * Search + category filtered, virtualized grid over the full
 * game-icons.net collection (~4100 icons, lazy-loaded — see
 * `GameIcons.ts`). Rendered inside `IconPicker`'s "Game Icons" tab.
 */
export function GameIconsPanel({
  value,
  onSelect,
}: GameIconsPanelProps): JSX.Element {
  const [ready, setReady] = useState(() => isGameIconsDataLoaded());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ready) {
      return;
    }
    let cancelled = false;
    void loadGameIconsData().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // `ready` doesn't appear in the callback body, but flipping it is what
  // makes `getGameIconNames()` (reading external module state) worth re-reading.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allNames = useMemo(() => getGameIconNames(), [ready]);

  const filteredNames = useMemo(() => {
    const queryTokens = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return allNames.filter((name) => {
      if (
        category !== ALL_CATEGORIES &&
        categorizeGameIconName(name) !== category
      ) {
        return false;
      }
      if (queryTokens.length === 0) {
        return true;
      }
      // Token match rather than one contiguous substring, so a multi-word
      // query matches regardless of word order in the icon's kebab-case name.
      const haystack = name.replace(/-/g, " ");
      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [allNames, search, category]);

  const rowCount = Math.ceil(filteredNames.length / COLUMNS);

  // @tanstack/react-virtual returns a mutable virtualizer instance whose
  // getVirtualItems()/getTotalSize() read live, externally-mutated state during
  // render, so the React Compiler cannot safely memoize this component and skips
  // it. The library, not our code, is incompatible; behavior is unaffected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex gap-2">
        <Input
          placeholder="Search game icons…"
          aria-label="Search game icons"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8"
        />
        <NativeSelect
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-40 shrink-0"
        >
          <option value={ALL_CATEGORIES}>All categories</option>
          {GAME_ICON_CATEGORIES.map(({ label }) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {!ready ? (
        <p className="p-4 text-center text-sm text-muted-foreground">
          Loading icon set…
        </p>
      ) : filteredNames.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">
          No icons found.
        </p>
      ) : (
        <div
          ref={scrollContainerRef}
          className="overflow-auto rounded-md border border-border"
          style={{ height: "14rem" }}
        >
          <div
            style={{
              height: `${String(virtualizer.getTotalSize())}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const rowStart = virtualRow.index * COLUMNS;
              const rowNames = filteredNames.slice(
                rowStart,
                rowStart + COLUMNS,
              );
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 grid w-full grid-cols-6 gap-1 px-2"
                  style={{
                    transform: `translateY(${String(virtualRow.start)}px)`,
                  }}
                >
                  {rowNames.map((name) => {
                    const fullName = toGameIconName(name);
                    const label = formatIconLabel(fullName);
                    const isSelected = value === fullName;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        title={label}
                        aria-label={label}
                        onClick={() => onSelect(fullName)}
                        className={cn(
                          "relative flex h-12 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent text-accent-foreground",
                        )}
                      >
                        <IconChip
                          icon={resolveEntityIcon(fullName)}
                          size="sm"
                        />
                        {isSelected && (
                          <Check className="absolute right-0.5 top-0.5 size-3" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Icons by{" "}
        <a
          href="https://game-icons.net"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          game-icons.net
        </a>
        , licensed{" "}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          CC BY 3.0
        </a>
        .
      </p>
    </div>
  );
}
