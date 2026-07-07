import { Plus, X } from "lucide-react";
import { useState, type JSX, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateLocalId } from "@/lib/uid";

type TagListEditorProps = {
  readonly entries: readonly string[];
  readonly label: string;
  readonly onChange: (entries: string[]) => void;
};

export function TagListEditor({
  entries,
  label,
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

  const getEntryKey = (index: number): string =>
    entryKeys[index] ?? `pending-${String(index)}`;

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
      </div>
    </fieldset>
  );
}

function createEntryKeys(count: number): string[] {
  return Array.from({ length: count }, () => generateLocalId());
}
