import type { JSX } from "react";

export function MetricTile({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-mono text-xl leading-none font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
