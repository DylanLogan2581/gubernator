import type { TurnTransitionResourceSnapshot } from "@/features/turns";

// Resource stockpiles are stored as numeric(18,4); differences below this are
// rounding/clamping noise, not a real forecast divergence.
const RESOURCE_DELTA_EPSILON = 0.01;

export function compareResourceDelta(
  forecastDelta: { readonly netDelta: number },
  actual: TurnTransitionResourceSnapshot,
): {
  readonly diverged: boolean;
  readonly forecastValue: number;
  readonly actualValue: number;
} {
  const forecastNetDelta = forecastDelta.netDelta;
  const actualNetDelta = actual.quantityAfter - actual.quantityBefore;

  return {
    actualValue: actualNetDelta,
    diverged:
      Math.abs(forecastNetDelta - actualNetDelta) > RESOURCE_DELTA_EPSILON,
    forecastValue: forecastNetDelta,
  };
}
