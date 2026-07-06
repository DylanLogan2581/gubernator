// Formats a resourceId -> amount delta map into a human-readable string,
// e.g. "Wood +4, Planks +2" — shared by job-breakdown and payload-renderer
// detail views that need to summarize resource quantity changes.

import type { TurnLogEntityLookup } from "../hooks/useTurnLogEntityLookup";

export function formatResourceDeltas(
  deltas: Readonly<Record<string, number>>,
  sign: "+" | "-",
  lookup: TurnLogEntityLookup,
): string {
  return Object.entries(deltas)
    .filter(([, amount]) => amount !== 0)
    .map(
      ([resourceId, amount]) =>
        `${lookup.resourceName(resourceId) ?? "Unknown resource"} ${sign}${Math.round(amount)}`,
    )
    .join(", ");
}
