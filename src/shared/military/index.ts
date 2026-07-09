// Public surface of the src/shared/military module.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export {
  computeArmyUpkeepRequirement,
  computeUnitProjectedDesertion,
  isUpkeepShortfall,
} from "./upkeepForecast.ts";
export type { ArmyUpkeepUnitInput, UpkeepCostEntry } from "./upkeepForecast.ts";
