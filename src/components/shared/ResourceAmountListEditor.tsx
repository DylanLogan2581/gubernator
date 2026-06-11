import { Plus, Trash2 } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type Resource } from "@/features/resources";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

export type ResourceAmountEntry = {
  readonly id: string;
  readonly resourceId: string;
  readonly amount: string;
  readonly notes?: string;
};

export function ResourceAmountListEditor({
  addLabel,
  amountLabel,
  disabled,
  entries,
  fieldError,
  label,
  onChange,
  resources,
  showNotes = false,
}: {
  readonly addLabel: string;
  readonly amountLabel: string;
  readonly disabled: boolean;
  readonly entries: readonly ResourceAmountEntry[];
  readonly fieldError?: string;
  readonly label: string;
  readonly onChange: (entries: ResourceAmountEntry[]) => void;
  readonly resources: readonly Resource[];
  readonly showNotes?: boolean;
}): JSX.Element {
  function handleAdd(): void {
    if (resources.length === 0) return;
    const usedIds = new Set(entries.map((e) => e.resourceId));
    const firstUnused = resources.find((r) => !usedIds.has(r.id));
    if (firstUnused === undefined) return;
    onChange([
      ...entries,
      {
        amount: "1",
        id: generateLocalId(),
        ...(showNotes ? { notes: "" } : {}),
        resourceId: firstUnused.id,
      },
    ]);
  }

  function handleRemove(index: number): void {
    onChange(entries.filter((_, i) => i !== index));
  }

  function handleResourceChange(index: number, resourceId: string): void {
    onChange(entries.map((e, i) => (i === index ? { ...e, resourceId } : e)));
  }

  function handleAmountChange(index: number, value: string): void {
    onChange(
      entries.map((e, i) => (i === index ? { ...e, amount: value } : e)),
    );
  }

  function handleNotesChange(index: number, value: string): void {
    onChange(entries.map((e, i) => (i === index ? { ...e, notes: value } : e)));
  }

  return (
    <fieldset className="grid gap-2">
      <div className="flex items-center justify-between">
        <legend className="text-sm text-muted-foreground">{label}</legend>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            resources.length === 0 ||
            entries.length >= resources.length
          }
          onClick={handleAdd}
        >
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
      {fieldError !== undefined ? (
        <p className="text-xs text-destructive">{fieldError}</p>
      ) : null}
      {entries.length > 0 ? (
        <ul className="grid gap-2">
          {entries.map((entry, index) => {
            const isDeletedResource = !resources.some(
              (r) => r.id === entry.resourceId,
            );
            return (
              <li key={entry.id} className="grid gap-1">
                <div className="flex items-center gap-2">
                  <NativeSelect
                    aria-invalid={isDeletedResource}
                    aria-label={`${label} entry ${String(index + 1)} resource`}
                    className="flex-1"
                    disabled={disabled}
                    value={isDeletedResource ? "" : entry.resourceId}
                    onChange={(e) => {
                      handleResourceChange(index, e.currentTarget.value);
                    }}
                  >
                    {isDeletedResource ? (
                      <option value="" disabled>
                        Deleted resource
                      </option>
                    ) : null}
                    {sortByName(resources).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label={`${label} entry ${String(index + 1)} ${amountLabel}`}
                    className="w-24 shrink-0"
                    disabled={disabled}
                    inputMode="decimal"
                    placeholder="1"
                    value={entry.amount}
                    onChange={(e) => {
                      handleAmountChange(index, e.currentTarget.value);
                    }}
                  />
                  {showNotes ? (
                    <Input
                      aria-label={`${label} entry ${String(index + 1)} notes`}
                      className="flex-1 min-w-0"
                      disabled={disabled}
                      placeholder="Notes (optional)"
                      value={entry.notes ?? ""}
                      onChange={(e) => {
                        handleNotesChange(index, e.currentTarget.value);
                      }}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${label} entry ${String(index + 1)}`}
                    disabled={disabled}
                    onClick={() => {
                      handleRemove(index);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isDeletedResource ? (
                  <p className="text-xs text-destructive">
                    This resource has been deleted. Remove this row or select a
                    different resource.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No {label.toLowerCase()}.
        </p>
      )}
    </fieldset>
  );
}
