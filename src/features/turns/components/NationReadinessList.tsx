import { CheckCircle2, CircleDashed } from "lucide-react";

import {
  formatNationReadinessVoteProgress,
  type NationReadinessListItem,
} from "@/features/nations";

import type { JSX } from "react";

// Nations with no settlements are exempt from readiness — nobody can vote
// for them, so they are never shown as blocking end turn.
export function NationReadinessList({
  items,
}: {
  readonly items: readonly NationReadinessListItem[];
}): JSX.Element | null {
  const relevantNations = items.filter((item) => item.hasSettlements);

  if (relevantNations.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Nation readiness</p>
      <ul className="grid gap-1.5">
        {relevantNations.map((item) => (
          <li
            key={item.nationId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-2">
              {item.isReady ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-4 text-emerald-600"
                />
              ) : (
                <CircleDashed
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
              )}
              {item.nationName}
            </span>
            <span className="text-muted-foreground">
              {formatNationReadinessVoteProgress(item)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
