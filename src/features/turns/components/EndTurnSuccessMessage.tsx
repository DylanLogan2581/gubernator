import { CircleCheck } from "lucide-react";

import type { JSX } from "react";

export type SuccessfulEndTurnTransition = {
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly previousDateLabel: string;
  readonly previousTurnNumber: number;
};

export function EndTurnSuccessMessage({
  transition,
}: {
  readonly transition: SuccessfulEndTurnTransition;
}): JSX.Element {
  return (
    <div
      className="grid gap-3 rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
      role="status"
    >
      <p className="flex items-start gap-2 font-medium">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        End-turn transition completed.
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <EndTurnDetail
          label="Previous turn"
          value={`Turn ${transition.previousTurnNumber}`}
        />
        <EndTurnDetail
          label="New turn"
          value={`Turn ${transition.nextTurnNumber}`}
        />
        <EndTurnDetail
          label="Previous date"
          value={transition.previousDateLabel}
        />
        <EndTurnDetail label="New date" value={transition.nextDateLabel} />
      </dl>
    </div>
  );
}

function EndTurnDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
