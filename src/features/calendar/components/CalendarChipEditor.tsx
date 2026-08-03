import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  onRemove,
  onReorder,
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
  readonly onRemove: (index: number) => void;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
  readonly onUpdate: (
    index: number,
    key: "dayCount" | "name",
    value: number | string,
  ) => void;
  readonly showDayCount?: boolean;
}): JSX.Element {
  const [newItemName, setNewItemName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const errorId = `calendar-${legend.toLowerCase()}-error`;
  const rowLabel = itemLabel ?? legend;
  const legendLower = legend.toLowerCase();

  function handleAdd(): void {
    onAdd(newItemName.trim());
    setNewItemName("");
  }

  function handleDrop(targetIndex: number): void {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      onReorder(dragIndex, targetIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
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
              className={cn(
                "flex items-center gap-1.5 rounded-md border bg-muted/40 p-1.5 transition-colors",
                dragIndex === index && "opacity-50",
                dropIndex === index && dragIndex !== index && "border-primary",
              )}
              onDragOver={(event) => {
                if (dragIndex === null) {
                  return;
                }
                event.preventDefault();
                setDropIndex(index);
              }}
              onDrop={() => handleDrop(index)}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                draggable
                className="size-8 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                aria-label={`Reorder ${legendLower} ${index + 1}`}
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </Button>
              <Input
                aria-label={nameLabel}
                className="h-9 flex-1"
                value={item.name}
                onChange={(event) =>
                  onUpdate(index, "name", event.currentTarget.value)
                }
              />
              {showDayCount ? (
                <Input
                  aria-label={`${rowLabel} ${index + 1} Days`}
                  className="h-9 w-20 shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-8"
                  disabled={index === 0}
                  aria-label={`Move ${legendLower} ${index + 1} up`}
                  onClick={() => onReorder(index, index - 1)}
                >
                  <ArrowUp aria-hidden="true" className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-8"
                  disabled={index === items.length - 1}
                  aria-label={`Move ${legendLower} ${index + 1} down`}
                  onClick={() => onReorder(index, index + 1)}
                >
                  <ArrowDown aria-hidden="true" className="size-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`Remove ${legendLower} ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                <X aria-hidden="true" className="size-4" />
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
