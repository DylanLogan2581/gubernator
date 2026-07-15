import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError } from "./CalendarFieldPrimitives";

export function CalendarChipEditor<
  TItem extends {
    readonly index: number;
    readonly name: string;
    readonly dayCount?: number;
  },
>({
  addButtonLabel,
  addPlaceholder,
  error,
  itemLabel,
  items,
  legend,
  onAdd,
  onMove,
  onRemove,
  onUpdate,
  showDayCount = false,
}: {
  readonly addButtonLabel: string;
  readonly addPlaceholder: string;
  readonly error?: string;
  readonly itemLabel?: string;
  readonly items: readonly TItem[];
  readonly legend: string;
  readonly onAdd: (name: string) => void;
  readonly onMove: (index: number, direction: "up" | "down") => void;
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (
    index: number,
    key: "dayCount" | "name",
    value: number | string,
  ) => void;
  readonly showDayCount?: boolean;
}): JSX.Element {
  const [newItemName, setNewItemName] = useState("");
  const errorId = `calendar-${legend.toLowerCase()}-error`;
  const rowLabel = itemLabel ?? legend;

  function handleAdd(): void {
    onAdd(newItemName.trim());
    setNewItemName("");
  }

  return (
    <fieldset
      aria-describedby={error === undefined ? undefined : errorId}
      aria-invalid={error === undefined ? undefined : true}
      className="grid gap-2"
    >
      <legend className="sr-only">{legend}</legend>
      {error === undefined ? null : <FieldError id={errorId} message={error} />}
      <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
        {items.map((item, index) => {
          const nameLabel = showDayCount
            ? `${rowLabel} ${index + 1} Name`
            : `${rowLabel} ${index + 1}`;

          return (
            <div
              key={item.index}
              className="flex items-center gap-0.5 rounded-full border bg-muted/40 py-1 pr-1 pl-1.5"
            >
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  disabled={index === 0}
                  aria-label={`Move ${legend.toLowerCase()} ${index + 1} up`}
                  onClick={() => onMove(index, "up")}
                >
                  <ArrowUp aria-hidden="true" className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  disabled={index === items.length - 1}
                  aria-label={`Move ${legend.toLowerCase()} ${index + 1} down`}
                  onClick={() => onMove(index, "down")}
                >
                  <ArrowDown aria-hidden="true" className="size-3" />
                </Button>
              </div>
              <Input
                aria-label={nameLabel}
                className="h-7 w-24 border-none bg-transparent px-1.5 shadow-none focus-visible:ring-1"
                value={item.name}
                onChange={(event) =>
                  onUpdate(index, "name", event.currentTarget.value)
                }
              />
              {showDayCount ? (
                <Input
                  aria-label={`${rowLabel} ${index + 1} Days`}
                  className="h-7 w-14 border-none bg-transparent px-1.5 shadow-none focus-visible:ring-1"
                  min={1}
                  type="number"
                  value={Number(item.dayCount)}
                  onChange={(event) =>
                    onUpdate(
                      index,
                      "dayCount",
                      Number(event.currentTarget.value),
                    )
                  }
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={`Remove ${legend.toLowerCase()} ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                <X aria-hidden="true" className="size-3" />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          aria-label={addPlaceholder}
          className="h-8 w-40"
          placeholder={addPlaceholder}
          value={newItemName}
          onChange={(event) => setNewItemName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus aria-hidden="true" />
          {addButtonLabel}
        </Button>
      </div>
    </fieldset>
  );
}
