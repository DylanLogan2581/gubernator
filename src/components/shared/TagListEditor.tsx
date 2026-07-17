import { ClipboardList, Plus, X } from "lucide-react";
import { useState, type JSX, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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

import { countBulkPastePieces, parseBulkPaste } from "./PoolEditorUtils";

type TagListEditorProps = {
  readonly entries: readonly string[];
  readonly label: string;
  readonly maxEntryLength?: number;
  readonly maxPoolSize?: number;
  readonly onChange: (entries: string[]) => void;
};

export function TagListEditor({
  entries,
  label,
  maxEntryLength,
  maxPoolSize,
  onChange,
}: TagListEditorProps): JSX.Element {
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newTagValue, setNewTagValue] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const getEntryKey = (index: number): string =>
    entryKeys[index] ?? `pending-${String(index)}`;

  function handleBulkApply(): void {
    const pieceCount = countBulkPastePieces(bulkText);
    const deduped = parseBulkPaste(bulkText, entries);
    const duplicateCount = pieceCount - deduped.length;

    let accepted = deduped;
    let tooLongCount = 0;
    if (maxEntryLength !== undefined) {
      const withinLength: string[] = [];
      for (const entry of accepted) {
        if (entry.length > maxEntryLength) {
          tooLongCount++;
        } else {
          withinLength.push(entry);
        }
      }
      accepted = withinLength;
    }

    let overLimitCount = 0;
    if (maxPoolSize !== undefined) {
      const availableSlots = Math.max(0, maxPoolSize - entries.length);
      if (accepted.length > availableSlots) {
        overLimitCount = accepted.length - availableSlots;
        accepted = accepted.slice(0, availableSlots);
      }
    }

    if (accepted.length > 0) {
      setEntryKeys((prev) => [...prev, ...createEntryKeys(accepted.length)]);
      onChange([...entries, ...accepted]);
    }

    const messageParts: string[] = [
      accepted.length === 1
        ? "Added 1 entry."
        : `Added ${String(accepted.length)} entries.`,
    ];
    if (duplicateCount > 0) {
      messageParts.push(`Skipped ${String(duplicateCount)} duplicate.`);
    }
    if (tooLongCount > 0) {
      messageParts.push(`Skipped ${String(tooLongCount)} too long.`);
    }
    if (overLimitCount > 0) {
      messageParts.push(
        `Skipped ${String(overLimitCount)} — pool limit reached.`,
      );
    }
    if (accepted.length > 0) {
      toast.success(messageParts.join(" "));
    } else {
      toast.error(messageParts.join(" "));
    }

    setBulkText("");
    setBulkOpen(false);
  }

  function handleAddTag(): void {
    const trimmed = newTagValue.trim();
    if (trimmed === "") return;
    setEntryKeys((prev) => [...prev, generateLocalId()]);
    onChange([...entries, trimmed]);
    setNewTagValue("");
  }

  function handleNewTagKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleAddTag();
    }
  }

  function handleRemoveEntry(index: number): void {
    setEntryKeys((prev) => prev.filter((_, i) => i !== index));
    onChange(entries.filter((_, i) => i !== index));
    setEditingIndex(null);
  }

  function startEditing(index: number): void {
    setEditingIndex(index);
    setEditingValue(entries[index] ?? "");
  }

  function commitEdit(index: number): void {
    const trimmed = editingValue.trim();
    if (trimmed === "") {
      handleRemoveEntry(index);
      return;
    }
    const next = [...entries];
    next[index] = trimmed;
    onChange(next);
    setEditingIndex(null);
  }

  function handleEditKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditingIndex(null);
    }
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
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {entries.map((entry, index) => (
            <li key={getEntryKey(index)}>
              {editingIndex === index ? (
                <Input
                  autoFocus
                  aria-label={`Edit entry ${String(index + 1)}`}
                  className="h-7 w-32"
                  value={editingValue}
                  onChange={(event) =>
                    setEditingValue(event.currentTarget.value)
                  }
                  onKeyDown={(event) => handleEditKeyDown(event, index)}
                  onBlur={() => commitEdit(index)}
                />
              ) : (
                <Badge
                  variant="secondary"
                  className="h-7 gap-1 rounded-full px-2.5 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => startEditing(index)}
                    aria-label={`Edit ${entry}`}
                  >
                    {entry}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove entry ${String(index + 1)}`}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-secondary-foreground/10"
                    onClick={() => handleRemoveEntry(index)}
                  >
                    <X aria-hidden="true" className="size-3!" />
                  </button>
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          aria-label={`Add ${label.toLowerCase()} entry`}
          placeholder="Add entry…"
          className="h-8 max-w-56"
          value={newTagValue}
          onChange={(event) => setNewTagValue(event.currentTarget.value)}
          onKeyDown={handleNewTagKeyDown}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddTag}
          disabled={newTagValue.trim() === ""}
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
              Add multiple entries from pasted text.
            </DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="Bulk import entries — one per line"
            className="h-32 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            placeholder="Paste one entry per line, or comma-separated…"
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
