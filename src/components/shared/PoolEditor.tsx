import { useVirtualizer } from "@tanstack/react-virtual";
import { ClipboardList, Plus, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateLocalId } from "@/lib/uid";

import { parseBulkPaste } from "./PoolEditorUtils";

const VIRTUALIZE_THRESHOLD = 50;

type PoolEditorProps = {
  readonly entries: readonly string[];
  readonly label: string;
  readonly onChange: (entries: string[]) => void;
};

export function PoolEditor({
  entries,
  label,
  onChange,
}: PoolEditorProps): JSX.Element {
  const [entryKeys, setEntryKeys] = useState(() =>
    createEntryKeys(entries.length),
  );
  // Keep the stable key list in sync with externally-driven entry-count
  // changes during render (React's "adjust state when a prop changes" pattern)
  // rather than in an effect, which avoids an extra commit and re-render.
  const [prevEntryCount, setPrevEntryCount] = useState(entries.length);
  if (prevEntryCount !== entries.length) {
    setPrevEntryCount(entries.length);
    setEntryKeys((prev) => {
      if (prev.length === entries.length) return prev;
      if (prev.length < entries.length) {
        return [...prev, ...createEntryKeys(entries.length - prev.length)];
      }
      return prev.slice(0, entries.length);
    });
  }
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = entries.length >= VIRTUALIZE_THRESHOLD;
  const getEntryKey = (index: number): string =>
    entryKeys[index] ?? `pending-${String(index)}`;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? entries.length : 0,
    getItemKey: getEntryKey,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 40,
  });

  useEffect(() => {
    if (pendingFocusIndex !== null && shouldVirtualize) {
      virtualizer.scrollToIndex(pendingFocusIndex, { behavior: "auto" });
    }
  }, [pendingFocusIndex, shouldVirtualize, virtualizer]);

  function handleAddEntry(): void {
    const newIndex = entries.length;
    setEntryKeys((prev) => [...prev, generateLocalId()]);
    onChange([...entries, ""]);
    setPendingFocusIndex(newIndex);
  }

  function handleEntryKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ): void {
    if (event.key === "Enter" && index === entries.length - 1) {
      event.preventDefault();
      handleAddEntry();
    }
  }

  function handleBulkApply(): void {
    const toAdd = parseBulkPaste(bulkText, entries);
    if (toAdd.length > 0) {
      setEntryKeys((prev) => [...prev, ...createEntryKeys(toAdd.length)]);
      onChange([...entries, ...toAdd]);
    }
    setBulkText("");
    setBulkOpen(false);
  }

  function makeInputRef(index: number): (el: HTMLInputElement | null) => void {
    return (el) => {
      if (el !== null && pendingFocusIndex === index) {
        el.focus();
        setPendingFocusIndex(null);
      }
    };
  }

  function handleEntryChange(index: number, value: string): void {
    const next = [...entries];
    next[index] = value;
    onChange(next);
  }

  function handleRemoveEntry(index: number): void {
    setEntryKeys((prev) => prev.filter((_, i) => i !== index));
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="flex items-baseline gap-1.5 text-sm font-medium">
        {label}
        {entries.length > 0 ? (
          <span className="text-xs font-normal text-muted-foreground">
            ({String(entries.length)})
          </span>
        ) : null}
      </legend>

      {entries.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No entries yet.</p>
      ) : shouldVirtualize ? (
        <div
          ref={scrollContainerRef}
          className="overflow-auto rounded-md border border-border"
          style={{ height: "18rem" }}
        >
          <ul
            style={{
              height: `${String(virtualizer.getTotalSize())}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const index = virtualItem.index;
              const entry = entries[index] ?? "";
              return (
                <li
                  key={virtualItem.key}
                  data-index={index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${String(virtualItem.start)}px)`,
                  }}
                  className="flex gap-2 px-1 py-0.5"
                >
                  <Input
                    value={entry}
                    ref={makeInputRef(index)}
                    onChange={(event) =>
                      handleEntryChange(index, event.currentTarget.value)
                    }
                    onKeyDown={(event) => handleEntryKeyDown(event, index)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove entry ${String(index + 1)}`}
                    onClick={() => handleRemoveEntry(index)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ul className="grid gap-1.5">
          {entries.map((entry, index) => (
            <li key={getEntryKey(index)} className="flex gap-2">
              <Input
                value={entry}
                ref={makeInputRef(index)}
                onChange={(event) =>
                  handleEntryChange(index, event.currentTarget.value)
                }
                onKeyDown={(event) => handleEntryKeyDown(event, index)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove entry ${String(index + 1)}`}
                onClick={() => handleRemoveEntry(index)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddEntry}
        >
          <Plus aria-hidden="true" />
          Add entry
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setBulkOpen(true)}
        >
          <ClipboardList aria-hidden="true" />
          Bulk import
        </Button>
      </div>

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkText("");
            setBulkOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk import — {label}</DialogTitle>
            <DialogDescription className="sr-only">
              Add multiple pool entries from pasted text.
            </DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="Bulk import entries — one per line"
            className="h-32 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            placeholder="Paste one entry per line…"
            value={bulkText}
            onChange={(event) => setBulkText(event.currentTarget.value)}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkText("");
                setBulkOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleBulkApply}
              disabled={bulkText.trim() === ""}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}

function createEntryKeys(count: number): string[] {
  return Array.from({ length: count }, () => generateLocalId());
}
