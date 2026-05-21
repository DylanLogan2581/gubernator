import { Plus, Trash2 } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError, NumberField } from "./CalendarFieldPrimitives";

import type { JSX } from "react";

export function CalendarListEditor<
  TItem extends {
    readonly index: number;
    readonly name: string;
    readonly dayCount?: number;
  },
>({
  addButtonLabel,
  error,
  fields,
  items,
  legend,
  onAdd,
  onRemove,
  onUpdate,
}: {
  readonly addButtonLabel: string;
  readonly error?: string;
  readonly fields: readonly {
    readonly key: Extract<keyof TItem, "dayCount" | "name">;
    readonly label: string;
    readonly type: "number" | "text";
  }[];
  readonly items: readonly TItem[];
  readonly legend: string;
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (
    index: number,
    key: Extract<keyof TItem, "dayCount" | "name">,
    value: number | string,
  ) => void;
}): JSX.Element {
  const errorId = `calendar-${legend.toLowerCase()}-error`;

  return (
    <fieldset
      aria-describedby={error === undefined ? undefined : errorId}
      aria-invalid={error === undefined ? undefined : true}
      className="grid gap-3"
    >
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium">{legend}</legend>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          {addButtonLabel}
        </Button>
      </div>
      {error === undefined ? null : <FieldError id={errorId} message={error} />}
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.index}
            className="grid gap-2 sm:grid-cols-[1fr_8rem_2rem]"
          >
            {fields.map((field) =>
              field.type === "number" ? (
                <NumberField
                  key={field.key}
                  label={`${legend} ${index + 1} ${field.label}`}
                  min={1}
                  value={Number(item[field.key])}
                  onChange={(value) => onUpdate(index, field.key, value)}
                />
              ) : (
                <label key={field.key} className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">
                    {legend} {index + 1} {field.label}
                  </span>
                  <Input
                    value={String(item[field.key])}
                    onChange={(event) =>
                      onUpdate(index, field.key, event.currentTarget.value)
                    }
                  />
                </label>
              ),
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end"
              aria-label={`Remove ${legend.toLowerCase()} ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
