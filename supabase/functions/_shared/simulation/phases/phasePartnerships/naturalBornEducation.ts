// Natural-born education assignment: each newborn independently rolls a
// weighted pick against the world's configured education levels, using each
// level's natural_born_percent as its share of a 0-100 roll. A level's slice
// is [cumulative, cumulative + naturalBornPercent); percentages not
// accounted for by any level (the world admin left some remainder) fall
// through to null (no education), matching the spec's "remainder = no
// education" rule. Levels are sorted by rank first so a fixed seed always
// walks the same order regardless of input ordering.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SeededRng } from "../../seededRng.ts";
import type { SimEducationLevel } from "../../simulationTypes.ts";

export function pickNaturalBornEducationLevelId(
  rng: SeededRng,
  educationLevels: readonly SimEducationLevel[],
): string | null {
  if (educationLevels.length === 0) return null;

  const sorted = [...educationLevels].sort((a, b) => a.rank - b.rank);
  const roll = rng() * 100;

  let cumulative = 0;
  for (const level of sorted) {
    cumulative += level.naturalBornPercent;
    if (roll < cumulative) return level.id;
  }

  return null;
}
