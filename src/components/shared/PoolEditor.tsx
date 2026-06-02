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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = entries.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? entries.length : 0,
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
            <li key={index} className="flex gap-2">
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
