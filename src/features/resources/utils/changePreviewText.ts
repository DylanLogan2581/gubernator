import type { ResourceChangeMode } from "../types/resourceTypes";

/**
 * Human-readable preview of a resource's configured per-turn change, e.g.
 * "Increases by 5% each turn." or "Removes 50 each turn."
 */
export function buildChangePreviewText(
  mode: ResourceChangeMode,
  amount: number,
): string {
  if (amount === 0 || Number.isNaN(amount)) return "No change per turn.";

  const magnitude = Math.abs(amount);

  if (mode === "percent") {
    return amount > 0
      ? `Increases by ${magnitude.toString()}% each turn.`
      : `Decreases by ${magnitude.toString()}% each turn.`;
  }

  return amount > 0
    ? `Adds ${magnitude.toString()} each turn.`
    : `Removes ${magnitude.toString()} each turn.`;
}
