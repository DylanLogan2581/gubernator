import type { JSX } from "react";

export function MetricTile({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-normal">{value}</dd>
    </div>
  );
}
