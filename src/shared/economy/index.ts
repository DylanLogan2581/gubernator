// Public surface of the src/shared/economy module.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export {
  clampConfidence,
  computeFiatSupplyGrowth,
  computeNextFiatConfidence,
  computeResourceBackedConfidence,
  computeResourceBackedHealth,
  FIAT_CONFIDENCE_COLLAPSE_WARNING_THRESHOLD,
  FIAT_CONFIDENCE_GROWTH_PENALTY_FACTOR,
  FIAT_CONFIDENCE_GROWTH_THRESHOLD,
  FIAT_CONFIDENCE_RECOVERY_RATE,
  isFiatConfidenceCollapsing,
  isResourceBackedInDefault,
} from "./currency.ts";
export type {
  FiatConfidenceInput,
  ResourceBackedHealthInput,
} from "./currency.ts";
