// Army upkeep requirement & desertion projection — single source of truth
// for both the turn-engine (Deno, via supabase/functions/_shared/military)
// and the browser UI (garrison card + upkeep forecast panel), so the sim
// and the forecast never drift (#1113).
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export type UpkeepCostEntry = {
  readonly amount: number;
  readonly resourceId: string;
};

export type ArmyUpkeepUnitInput = {
  readonly desertionRate: number;
  readonly soldierCount: number;
  readonly unitId: string;
  readonly upkeepCostsJson: readonly UpkeepCostEntry[];
};

// Mirrors the numeric(18,4) scale that apply_turn_transition clamps
// stockpile writes to (see decimalMath.ts's floorToDatabaseScale) — keeps
// the forecast's required amounts identical to what the sim will charge.
function floorToUpkeepScale(value: number): number {
  return Math.floor(value * 10000) / 10000;
}

/**
 * Sums per-resource upkeep across every unit, floored per unit-resource
 * pair. Units with zero soldiers contribute nothing. Mirrors
 * phaseMilitaryUpkeep's charge loop exactly.
 */
export function computeArmyUpkeepRequirement(
  units: readonly ArmyUpkeepUnitInput[],
): ReadonlyMap<string, number> {
  const requiredByResourceId = new Map<string, number>();
  for (const unit of units) {
    if (unit.soldierCount <= 0) continue;
    for (const cost of unit.upkeepCostsJson) {
      const amount = floorToUpkeepScale(cost.amount * unit.soldierCount);
      requiredByResourceId.set(
        cost.resourceId,
        (requiredByResourceId.get(cost.resourceId) ?? 0) + amount,
      );
    }
  }
  return requiredByResourceId;
}

/** True when any required resource exceeds what's available in the funding pool. */
export function isUpkeepShortfall(
  requiredByResourceId: ReadonlyMap<string, number>,
  availableByResourceId: ReadonlyMap<string, number>,
): boolean {
  for (const [resourceId, required] of requiredByResourceId) {
    if (required <= 0) continue;
    const available = Math.max(0, availableByResourceId.get(resourceId) ?? 0);
    if (available < required) return true;
  }
  return false;
}

/**
 * Deserters projected for one unit if upkeep goes unpaid —
 * floor(soldiers * rate), minimum 1 when the rate is positive and soldiers
 * exist. Matches phaseMilitaryUpkeep's desertion count; which soldiers
 * actually desert is decided by seeded RNG only during the real turn
 * transition, so this is a count projection, not a selection.
 */
export function computeUnitProjectedDesertion(
  soldierCount: number,
  desertionRate: number,
): number {
  if (soldierCount <= 0 || desertionRate <= 0) return 0;
  const rawCount = Math.floor(soldierCount * desertionRate);
  return Math.min(soldierCount, Math.max(rawCount, 1));
}
