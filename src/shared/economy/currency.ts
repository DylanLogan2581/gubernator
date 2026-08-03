// Currency simulation constants and pure formulas — single source of truth
// for both the turn-engine (Deno, via supabase/functions/_shared/economy) and
// the browser UI (confidence forecast charts).
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.
// Deterministic: no RNG.

// Fiat confidence: supply growth beyond this fraction per turn erodes trust.
export const FIAT_CONFIDENCE_GROWTH_THRESHOLD = 0.05;
// Penalty applied to confidence per unit of growth above the threshold.
export const FIAT_CONFIDENCE_GROWTH_PENALTY_FACTOR = 0.5;
// Slow passive recovery toward full confidence (1) each turn.
export const FIAT_CONFIDENCE_RECOVERY_RATE = 0.02;
// Below this, a fiat currency is considered to be collapsing (warning notification).
export const FIAT_CONFIDENCE_COLLAPSE_WARNING_THRESHOLD = 0.25;

export function clampConfidence(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export type FiatConfidenceInput = {
  readonly burnedThisTurn: number;
  readonly confidence: number;
  readonly mintedThisTurn: number;
  readonly moneySupplyStart: number;
};

// growth = (minted - burned) / max(money_supply_start, 1).
export function computeFiatSupplyGrowth({
  burnedThisTurn,
  mintedThisTurn,
  moneySupplyStart,
}: Pick<
  FiatConfidenceInput,
  "burnedThisTurn" | "mintedThisTurn" | "moneySupplyStart"
>): number {
  return (mintedThisTurn - burnedThisTurn) / Math.max(moneySupplyStart, 1);
}

// confidence_next = clamp(confidence - max(0, growth - 0.05) * 0.5 + 0.02, 0, 1).
export function computeNextFiatConfidence(input: FiatConfidenceInput): number {
  const growth = computeFiatSupplyGrowth(input);
  const penalty =
    Math.max(0, growth - FIAT_CONFIDENCE_GROWTH_THRESHOLD) *
    FIAT_CONFIDENCE_GROWTH_PENALTY_FACTOR;
  return clampConfidence(
    input.confidence - penalty + FIAT_CONFIDENCE_RECOVERY_RATE,
  );
}

export function isFiatConfidenceCollapsing(confidence: number): boolean {
  return confidence < FIAT_CONFIDENCE_COLLAPSE_WARNING_THRESHOLD;
}

export type ResourceBackedHealthInput = {
  readonly backingRatio: number;
  readonly moneySupply: number;
  readonly reserveQuantity: number;
};

// health = reserve_quantity * backing_ratio / max(money_supply, 1). Not
// stored as confidence directly — 1.0 means fully backed, >1 overcollateralized.
export function computeResourceBackedHealth({
  backingRatio,
  moneySupply,
  reserveQuantity,
}: ResourceBackedHealthInput): number {
  return (reserveQuantity * backingRatio) / Math.max(moneySupply, 1);
}

// Default triggers when money supply exceeds what current reserves can back
// (e.g. reserves drained by other effects since the last check).
export function isResourceBackedInDefault({
  backingRatio,
  moneySupply,
  reserveQuantity,
}: ResourceBackedHealthInput): boolean {
  return moneySupply > reserveQuantity * backingRatio;
}

// Confidence for a resource-backed currency: 0 while in default (recovery
// only once backing is restored), otherwise the clamped backing health.
export function computeResourceBackedConfidence(
  input: ResourceBackedHealthInput,
): number {
  if (isResourceBackedInDefault(input)) return 0;
  return clampConfidence(computeResourceBackedHealth(input));
}
