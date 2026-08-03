import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Checkbox } from "@/components/ui/checkbox";

import { discoveryPairKey } from "./NationDiscoveryUtils";

import type { Nation, NationDiscoveryPair } from "../../types/nationTypes";

type NationDiscoveryListProps = {
  readonly canEdit: boolean;
  readonly rows: readonly Nation[];
  readonly columns: readonly Nation[];
  readonly pairsByKey: ReadonlyMap<string, NationDiscoveryPair>;
  readonly pendingKey: string | null;
  readonly onToggle: (nationA: Nation, nationB: Nation, met: boolean) => void;
};

export function NationDiscoveryList({
  canEdit,
  rows,
  columns,
  pairsByKey,
  pendingKey,
  onToggle,
}: NationDiscoveryListProps): JSX.Element {
  const pairs: { readonly a: Nation; readonly b: Nation }[] = [];
  rows.forEach((row, rowIndex) => {
    columns.forEach((column) => {
      if (column.id === row.id) {
        return;
      }
      // Skip pairs already listed from the other nation's row (see
      // NationDiscoveryGrid for the same de-duplication rule).
      const mirrorRowIndex = rows.findIndex(
        (candidate) => candidate.id === column.id,
      );
      if (mirrorRowIndex !== -1 && mirrorRowIndex < rowIndex) {
        return;
      }
      pairs.push({ a: row, b: column });
    });
  });

  if (pairs.length === 0) {
    return (
      <EmptyState
        title="No pairs to show"
        description="Add another nation to record discoveries between them."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {pairs.map(({ a, b }) => {
        const key = discoveryPairKey(a.id, b.id);
        const pair = pairsByKey.get(key);
        const met = pair !== undefined;
        const isPending = pendingKey === key;

        return (
          <li
            key={key}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {a.name} ↔ {b.name}
              </span>
              {met ? (
                <span className="text-xs text-muted-foreground">
                  Met at turn {pair.metAtTurnNumber}
                </span>
              ) : null}
            </div>
            <Checkbox
              aria-label={`${a.name} has met ${b.name}`}
              checked={met}
              disabled={!canEdit || isPending}
              onCheckedChange={() => {
                onToggle(a, b, !met);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
