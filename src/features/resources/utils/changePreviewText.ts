import type { ResourceChangeMode } from "../types/resourceTypes";

/**
 * Mirrors `checkPercentChangeAmountRange` in resourceSchemas.ts so forms can
 * flag an out-of-range percent decay as the user types, instead of only on
 * submit.
 */
export function isPercentChangeBelowMinimum(
  mode: ResourceChangeMode,
  amount: number,
): boolean {
  return mode === "percent" && amount < -100;
}

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
