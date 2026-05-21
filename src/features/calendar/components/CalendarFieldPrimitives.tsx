import { Input } from "@/components/ui/input";

import type { JSX } from "react";


export function NumberField({
  describedBy,
  error,
  label,
  max,
  min,
  onChange,
  value,
}: {
  readonly describedBy?: string;
  readonly error?: string;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        aria-describedby={describedBy}
        aria-invalid={error === undefined ? undefined : true}
        max={max}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {error === undefined || describedBy === undefined ? null : (
        <FieldError id={describedBy} message={error} />
      )}
    </label>
  );
}

export function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string;
}): JSX.Element {
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
