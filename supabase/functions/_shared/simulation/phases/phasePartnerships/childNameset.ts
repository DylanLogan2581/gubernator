// Child nameset heredity: a child picks one of its parents' namesets 50/50.
// An invalid parent nameset (deleted, trashed, or otherwise absent from the
// valid set) is skipped in favor of the other parent. When neither parent has
// a valid nameset, the settlement's location-resolved fallback nameset
// (settlement -> nation -> world default) becomes the child's nameset so it
// can be passed down. When no fallback exists either, the child has none.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SeededRng } from "../../seededRng.ts";

export function pickChildNamesetId(
  rng: SeededRng,
  parentANamesetId: string | null,
  parentBNamesetId: string | null,
  isValidNamesetId: (namesetId: string) => boolean,
  fallbackNamesetId: string | null,
): string | null {
  const validA = parentANamesetId !== null && isValidNamesetId(parentANamesetId)
    ? parentANamesetId
    : null;
  const validB = parentBNamesetId !== null && isValidNamesetId(parentBNamesetId)
    ? parentBNamesetId
    : null;

  if (validA !== null && validB !== null) {
    return rng() < 0.5 ? validA : validB;
  }
  if (validA !== null) return validA;
  if (validB !== null) return validB;

  if (fallbackNamesetId !== null && isValidNamesetId(fallbackNamesetId)) {
    return fallbackNamesetId;
  }
  return null;
}
