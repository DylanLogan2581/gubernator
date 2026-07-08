// Culture/religion heredity: a child inherits one parent's value 50/50 when
// both parents have one, the non-null parent's value when only one does, and
// null when neither does. Each call to this helper represents one field's
// independent roll of the shared seeded RNG (culture and religion are rolled
// separately, per the fertility spec).
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SeededRng } from "../../seededRng.ts";

export function pickInheritedFieldId(
  rng: SeededRng,
  parentAId: string | null,
  parentBId: string | null,
): string | null {
  if (parentAId !== null && parentBId !== null) {
    return rng() < 0.5 ? parentAId : parentBId;
  }
  return parentAId ?? parentBId;
}
